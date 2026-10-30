package com.newaveflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.dto.attendance.AttendanceBatchRequest;
import com.newaveflow.dto.report.WeeklyReportDto.*;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.*;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import java.io.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.zip.*;
import javax.xml.parsers.DocumentBuilderFactory;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class WeeklyReportHttpTest {
    static final LocalDate DAY=LocalDate.of(2026,10,25);
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired JwtTokenProvider tokens;
    @Autowired UserRepository users;
    @Autowired CommunityAgreementRepository agreements;
    @Autowired ClassGroupRepository classes;
    @Autowired StudentRepository students;
    @Autowired TeacherClassRepository assignments;
    @Autowired AttendanceRepository attendanceRows;
    @Autowired DailyReportRepository daily;
    @Autowired AttendanceService attendance;
    @Autowired WeeklyReportSourceService sources;
    @Autowired WeeklyReportService weekly;
    @Autowired WeeklyReportDocumentService documents;
    User account(String name,User.Role role) {
        var u=users.saveAndFlush(User.builder().name(name).email(UUID.randomUUID()+"@example.invalid").password("synthetic").role(role).build());
        agreements.saveAndFlush(new CommunityAgreement(u.getId(),CommunitySafetyService.POLICY_VERSION));return u;
    }
    String auth(User u){return "Bearer "+tokens.createAccessToken(u.getId(),u.getEmail(),u.getRole().name(),u.getAuthVersion());}
    ClassGroup group(User u) {var c=classes.saveAndFlush(ClassGroup.builder().name("가상 은혜반").ageGroup("중1").build());assignments.saveAndFlush(TeacherClass.builder().teacher(u).classGroup(c).isPrimary(true).build());return c;}
    Student student(ClassGroup c,String name,String gender) {return students.saveAndFlush(Student.builder().name(name).gender(gender).grade("중1").classGroup(c).build());}
    Member member(Student s,String category,boolean grad) {return new Member(s.getId(),category,grad,s.getGender(),"가상학교","가상 주소","010-0000-0000","가상인도자");}
    Map<String,String> fields(){return new TreeMap<>(Map.of("department","청소년부","author","가상담당","director","가상총괄","pastor","가상목사","scripture","요한복음 3:16","sermon","가상 설교 제목","preacher","가상설교자","offering","12000","includeLate","true"));}
    Map<String,byte[]> unzip(byte[] bytes)throws Exception{Map<String,byte[]> entries=new LinkedHashMap<>();try(var zip=new ZipInputStream(new ByteArrayInputStream(bytes))){for(ZipEntry e;(e=zip.getNextEntry())!=null;)entries.put(e.getName(),zip.readAllBytes());}return entries;}
    String cell(byte[] bytes,int row,int col)throws Exception {
        var f=DocumentBuilderFactory.newInstance();f.setNamespaceAware(true);var doc=f.newDocumentBuilder().parse(new ByteArrayInputStream(unzip(bytes).get("Contents/section0.xml")));
        var cells=doc.getElementsByTagNameNS("http://www.hancom.co.kr/hwpml/2011/paragraph","tc");
        for(int i=0;i<cells.getLength();i++){var c=(org.w3c.dom.Element)cells.item(i);var a=(org.w3c.dom.Element)c.getElementsByTagNameNS("*","cellAddr").item(0);if(a.getAttribute("rowAddr").equals(""+row)&&a.getAttribute("colAddr").equals(""+col)){var t=c.getElementsByTagNameNS("*","t");StringBuilder s=new StringBuilder();for(int j=0;j<t.getLength();j++)s.append(t.item(j).getTextContent());return s.toString();}}
        throw new AssertionError("Missing cell "+row+":"+col);
    }
    @Test void submitsAggregatesCorrectsAndDownloadsOneImmutableReport()throws Exception {
        var admin=account("가상관리자",User.Role.ADMIN);var teacher=account("가상교사",User.Role.TEACHER);var c=group(teacher);
        assignments.saveAndFlush(TeacherClass.builder().teacher(admin).classGroup(c).isPrimary(false).build());
        var s=student(c,"가상가람","남");var absent=student(c,"가상나래","여");var family=student(c,"가상다온","여");
        var extra=new Supplement(List.of(member(s,"REGULAR",true),member(absent,"REGULAR",false),member(family,"FAMILY",false)),List.of(new Visitor("visitor-1","가상라온","남","중1","가상학교","가상주소","010-0000-0001","가상인도자","PRESENT")),"반에서 제출한 특이사항");
        sources.saveSupplement(c.getId(),DAY,extra,admin); // Classification and newcomer confirmation belong to administration/team reporting.
        http.perform(put("/api/weekly-reports/classes/{id}",c.getId()).param("date",DAY.toString()).header("Authorization",auth(teacher)).contentType("application/json").content(json.writeValueAsString(extra))).andExpect(status().isOk());
        attendance.saveBatch(new AttendanceBatchRequest(c.getId(),DAY,List.of(new AttendanceBatchRequest.Record(s.getId(),"LATE","","남길 메모"),new AttendanceBatchRequest.Record(absent.getId(),"ABSENT","남길 결석 사유","남길 상세 메모"),new AttendanceBatchRequest.Record(family.getId(),"PRESENT","",""))),teacher.getId());
        attendance.submitReport(c.getId(),DAY,teacher.getId());
        assertEquals(1,weekly.get(DAY).classes().size());assertEquals("UNKNOWN",weekly.get(DAY).teachers().get(0).status());
        for(var u:List.of(admin,teacher))http.perform(put("/api/weekly-reports/my-worship").param("date",DAY.toString()).header("Authorization",auth(u)).contentType("application/json").content("{\"gender\":\"남\",\"status\":\"PRESENT\"}")).andExpect(status().isOk());
        var f=fields();f.put("notes","부서 공통 & <안내>");f.put("monthPlan","첫째 주: 가상 일정\n둘째 주: 가상 일정");f.put("nextPlan","다음 달 가상 계획");
        var report=weekly.saveDraft(DAY,new DraftInput(-1L,f));assertTrue(report.issues().isEmpty(),report.issues().toString());
        var prepare=http.perform(post("/api/weekly-reports/{date}/exports",DAY).header("Authorization",auth(admin)).contentType("application/json").content(json.writeValueAsString(new ExportRequest(report.sourceHash(),report.draftRevision())))).andExpect(status().isOk()).andReturn();
        long id=json.readTree(prepare.getResponse().getContentAsString()).get("id").asLong();
        var hwpx=http.perform(get("/api/weekly-reports/exports/{id}/hwpx",id).header("Authorization",auth(admin))).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andReturn().getResponse().getContentAsByteArray();
        assertEquals("2",cell(hwpx,10,5));assertEquals("1",cell(hwpx,10,8));assertEquals("1",cell(hwpx,10,11));assertEquals("3",cell(hwpx,10,27));assertEquals("1",cell(hwpx,10,30));assertEquals("2",cell(hwpx,10,38));
        assertTrue(cell(hwpx,91,0).contains("반에서 제출한 특이사항"));assertTrue(cell(hwpx,91,0).contains("부서 공통 & <안내>"));
        assertFalse(new String(unzip(hwpx).get("Contents/section0.xml"),StandardCharsets.UTF_8).contains("{{"));
        var pdf=http.perform(get("/api/weekly-reports/exports/{id}/pdf",id).header("Authorization",auth(admin))).andExpect(status().isOk()).andExpect(content().contentTypeCompatibleWith("application/pdf")).andReturn().getResponse().getContentAsByteArray();
        String html=documents.html(report);assertTrue(html.contains("&lt;안내&gt;"));assertFalse(html.contains("<script"));
        try(var document=Loader.loadPDF(pdf)){String text=new PDFTextStripper().getText(document);assertTrue(text.contains("가상"));assertTrue(text.contains("12,000"));assertTrue(document.getNumberOfPages()>0);writeSamples(hwpx,pdf,html,report,document);}
        var originalHeader=new org.springframework.core.io.ClassPathResource("report-templates/church-250622-v1.hwpx").getContentAsByteArray();assertArrayEquals(unzip(originalHeader).get("Contents/header.xml"),unzip(hwpx).get("Contents/header.xml"));
        // Changing live attendance keeps the last submission intact and blocks a new export.
        attendance.saveBatch(new AttendanceBatchRequest(c.getId(),DAY,List.of(new AttendanceBatchRequest.Record(s.getId(),"ABSENT","수정된 사유","남길 메모"))),teacher.getId());
        var dirty=weekly.get(DAY);assertTrue(dirty.classes().get(0).changed());assertEquals("LATE",dirty.classes().get(0).students().stream().filter(x->s.getId().equals(x.studentId())).findFirst().orElseThrow().status());
        http.perform(post("/api/weekly-reports/{date}/exports",DAY).header("Authorization",auth(admin)).contentType("application/json").content(json.writeValueAsString(new ExportRequest(report.sourceHash(),report.draftRevision())))).andExpect(status().isConflict());
        var editor=sources.editor(c.getId(),DAY,admin);var statuses=new HashMap<String,String>();editor.students().stream().filter(x->x.studentId()!=null).forEach(x->statuses.put(x.id(),x.status()));
        weekly.correctClass(c.getId(),DAY,new CorrectionInput(extra,statuses,"담당 교사에게 확인",editor.sourceHash()),admin);
        assertEquals("남길 결석 사유",attendanceRows.findByStudentIdAndAttendanceDate(absent.getId(),DAY).orElseThrow().getAbsentReason());
        assertEquals("남길 상세 메모",attendanceRows.findByStudentIdAndAttendanceDate(absent.getId(),DAY).orElseThrow().getNote());
        assertEquals(2,daily.findFirstByClassGroupIdAndReportDateOrderByIdAsc(c.getId(),DAY).orElseThrow().getSubmissionRevision());
        assertFalse(documents.html(weekly.get(DAY)).contains("담당 교사에게 확인"));
        assertEquals("3",cell(documents.hwpx(weekly.exported(id)),10,27));
        assertEquals("2",cell(documents.hwpx(weekly.get(DAY)),10,27));
    }
    void writeSamples(byte[] hwpx,byte[] pdf,String html,Report report,org.apache.pdfbox.pdmodel.PDDocument document)throws Exception {
        String output=System.getProperty("verification.output");if(output==null)return;Path dir=Path.of(output);Files.createDirectories(dir);
        Files.write(dir.resolve("weekly-report-synthetic.hwpx"),hwpx);Files.write(dir.resolve("weekly-report-synthetic.pdf"),pdf);Files.writeString(dir.resolve("weekly-report-synthetic.html"),html);Files.writeString(dir.resolve("weekly-report-synthetic.json"),json.writeValueAsString(report));
        var renderer=new PDFRenderer(document);for(int i=0;i<document.getNumberOfPages();i++)javax.imageio.ImageIO.write(renderer.renderImageWithDPI(i,120),"PNG",dir.resolve("weekly-report-page-"+(i+1)+".png").toFile());
    }
    @Test void authorizationMissingDataAndStaleWritesAreRejected()throws Exception {
        var admin=account("가상관리",User.Role.ADMIN);var teacher=account("가상담임",User.Role.TEACHER);var stranger=account("가상다른교사",User.Role.TEACHER);var c=group(teacher);student(c,"가상학생","남");
        http.perform(get("/api/weekly-reports/{date}",DAY).header("Authorization",auth(teacher))).andExpect(status().isForbidden());
        http.perform(get("/api/weekly-reports/classes/{id}",c.getId()).param("date",DAY.toString()).header("Authorization",auth(stranger))).andExpect(status().isForbidden());
        http.perform(get("/api/weekly-reports/{date}",DAY.plusDays(1)).header("Authorization",auth(admin))).andExpect(status().isBadRequest());
        http.perform(get("/api/weekly-reports/{date}",DAY)).andExpect(status().isUnauthorized());
        var report=weekly.get(DAY);assertTrue(report.issues().stream().anyMatch(i->i.area().equals("class")));
        http.perform(post("/api/weekly-reports/{date}/exports",DAY).header("Authorization",auth(admin)).contentType("application/json").content(json.writeValueAsString(new ExportRequest(report.sourceHash(),report.draftRevision())))).andExpect(status().isBadRequest());
        weekly.saveDraft(DAY,new DraftInput(-1L,fields()));
        http.perform(put("/api/weekly-reports/{date}",DAY).header("Authorization",auth(admin)).contentType("application/json").content(json.writeValueAsString(new DraftInput(-1L,fields())))).andExpect(status().isConflict());
        http.perform(put("/api/weekly-reports/{date}/teachers/{id}",DAY,teacher.getId()).header("Authorization",auth(admin)).contentType("application/json").content("{\"gender\":\"여\",\"status\":\"PRESENT\"}")).andExpect(status().isBadRequest());
        http.perform(get("/api/weekly-reports/exports/1/pdf").header("Authorization",auth(teacher))).andExpect(status().isForbidden());
    }
    @Test void overflowRowsAndLongNotesArePreservedInBothFiles()throws Exception {
        List<ClassSource> rows=new ArrayList<>();List<StudentRow> visitors=new ArrayList<>();
        for(int i=0;i<14;i++)visitors.add(new StudentRow("visitor:"+i,null,"방문가상"+i,"남","중1","가상반","FIRST","PRESENT",false,"가상학교","가상주소","010-0000-0000","가상인도자"));
        for(int i=0;i<12;i++)rows.add(new ClassSource((long)i,"가상반"+i,"중1","가상교사",1,true,false,false,LocalDateTime.now(),i==0?visitors:List.of(),"",""));
        var f=fields();f.put("notes","긴 특이사항 검증입니다. ".repeat(150)+"마지막문장확인");
        var report=new Report(DAY,0,"synthetic",f,rows,List.of(),List.of(),List.of());
        var hwpx=documents.hwpx(report);String xml=new String(unzip(hwpx).get("Contents/section0.xml"),StandardCharsets.UTF_8);
        assertTrue(xml.contains("rowCnt=\"101\""));assertTrue(xml.contains("방문가상13"));assertTrue(xml.contains("가상반11"));assertFalse(xml.contains("{{"));
        try(var pdf=Loader.loadPDF(documents.pdf(report))){String text=new PDFTextStripper().getText(pdf).replaceAll("\\s+","");assertTrue(text.contains("방문가상13"));assertTrue(text.contains("가상반11"));assertTrue(text.contains("마지막문장확인"));}
    }

    @Test void firstVisitsWaitForTeamConfirmationWithoutEnrollingOrDoubleCounting()throws Exception {
        var admin=account("가상관리",User.Role.ADMIN);var teacher=account("가상담임",User.Role.TEACHER);var c=group(teacher);
        var enrolled=student(c,"가상배정학생","남");long rosterSize=students.count();
        sources.saveSupplement(c.getId(),DAY,new Supplement(List.of(member(enrolled,"REGULAR",true)),List.of(),""),admin);
        var first=new Visitor("first-visit","가상첫방문","여","중1","가상학교","가상주소","010-0000-0100",enrolled.getName(),"PRESENT",true);
        var forged=new Supplement(List.of(member(enrolled,"FAMILY",false)),List.of(first),"팀에 전달할 참고 내용");
        http.perform(put("/api/weekly-reports/classes/{id}",c.getId()).param("date",DAY.toString()).header("Authorization",auth(teacher))
            .contentType("application/json").content(json.writeValueAsString(forged))).andExpect(status().isOk())
            .andExpect(jsonPath("$.visitors[0].teamConfirmed").value(false));
        var saved=sources.supplement(c.getId(),DAY);
        assertEquals("REGULAR",saved.members().get(0).category());assertTrue(saved.members().get(0).graduated());
        attendance.saveBatch(new AttendanceBatchRequest(c.getId(),DAY,List.of(new AttendanceBatchRequest.Record(enrolled.getId(),"PRESENT","",""))),teacher.getId());
        attendance.submitReport(c.getId(),DAY,teacher.getId());
        var pending=weekly.get(DAY);
        assertTrue(pending.issues().stream().anyMatch(i->i.message().contains("새가족팀 출결 확인")));
        var waitingFile=documents.hwpx(pending);
        assertEquals("0",cell(waitingFile,10,19));assertEquals("1",cell(waitingFile,10,27));
        assertEquals(rosterSize,students.count());assertTrue(sources.supplement(c.getId(),DAY.plusWeeks(1)).visitors().isEmpty());

        var confirmed=new Supplement(saved.members(),List.of(first),saved.notes());
        var editor=sources.editor(c.getId(),DAY,admin);
        http.perform(put("/api/weekly-reports/{date}/classes/{id}/correction",DAY,c.getId()).header("Authorization",auth(admin))
            .contentType("application/json").content(json.writeValueAsString(new CorrectionInput(confirmed,Map.of("student:"+enrolled.getId(),"PRESENT"),"새가족팀 출결·중복 확인",editor.sourceHash()))))
            .andExpect(status().isOk());
        var confirmedFile=documents.hwpx(weekly.get(DAY));
        assertEquals("1",cell(confirmedFile,10,19));assertEquals("0",cell(confirmedFile,10,14));
        assertEquals("1",cell(confirmedFile,10,5));assertEquals("2",cell(confirmedFile,10,27));
        assertTrue(sources.saveTeacherSupplement(c.getId(),DAY,forged,teacher).visitors().get(0).teamConfirmed());
        // A stale teacher form cannot delete team-confirmed records or classifications.
        var omitted=sources.saveTeacherSupplement(c.getId(),DAY,new Supplement(List.of(),List.of(),""),teacher);
        assertEquals(1,omitted.visitors().size());assertTrue(omitted.members().get(0).graduated());
        var changed=new Visitor(first.id(),first.name(),first.gender(),first.grade(),first.school(),first.address(),"010-0000-0200",first.introducer(),"ABSENT",true);
        var preserved=sources.saveTeacherSupplement(c.getId(),DAY,new Supplement(List.of(),List.of(changed),""),teacher).visitors().get(0);
        assertTrue(preserved.teamConfirmed());assertEquals(first.phone(),preserved.phone());assertEquals("PRESENT",preserved.status());
        var stale=new Visitor(first.id(),first.name(),"",first.grade(),"","","",first.introducer(),"PRESENT",false);
        assertEquals(first.phone(),sources.saveTeacherSupplement(c.getId(),DAY,new Supplement(List.of(),List.of(stale),""),teacher).visitors().get(0).phone());
        attendance.submitReport(c.getId(),DAY,teacher.getId());
        assertFalse(weekly.get(DAY).issues().stream().anyMatch(i->i.message().contains("새가족팀 출결 확인")));
        assertEquals(rosterSize,students.count());assertEquals(c.getId(),students.findById(enrolled.getId()).orElseThrow().getClassGroup().getId());
        // Stored reports created before confirmation was introduced remain readable.
        var legacy=json.readValue("{\"id\":\"old\",\"name\":\"가상이전\",\"status\":\"PRESENT\"}",Visitor.class);
        assertNull(legacy.teamConfirmed());
    }

    @Test void teacherChecksUseRegisteredProfilesAndOnlyAssignedClasses()throws Exception {
        var teacher=account("가상담임",User.Role.TEACHER);var other=account("가상다른교사",User.Role.TEACHER);
        var c=group(teacher);var unrelated=group(other);var student=student(c,"가상등록학생","남");
        student.update(student.getName(),"남",null,"등록학교","010-0000-0031",null,null,null,null,null,"등록주소",null);
        students.saveAndFlush(student);
        http.perform(put("/api/users/me/profile").header("Authorization",auth(teacher)).contentType("application/json")
            .content("{\"name\":\"가상담임\",\"gender\":\"여\"}")).andExpect(status().isOk());
        http.perform(get("/api/users/me/profile").header("Authorization",auth(teacher))).andExpect(jsonPath("$.gender").value("여"));
        http.perform(put("/api/weekly-reports/my-worship").param("date",DAY.toString()).header("Authorization",auth(teacher))
            .contentType("application/json").content("{\"status\":\"PRESENT\",\"gender\":\"남\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.gender").value("여"));
        // A missing profile never blocks the teacher's attendance check; administration sees the missing field.
        http.perform(put("/api/weekly-reports/my-worship").param("date",DAY.toString()).header("Authorization",auth(other))
            .contentType("application/json").content("{\"status\":\"PRESENT\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.gender").value(""));
        assertTrue(weekly.get(DAY).issues().stream().anyMatch(i->i.area().equals("teacher")&&i.targetId().equals(other.getId())&&i.message().contains("성별")));

        var extra=new Supplement(List.of(new Member(student.getId(),"REGULAR",false,"여","오래된학교","오래된주소","오래된번호","")),List.of(),"");
        http.perform(put("/api/weekly-reports/classes/{id}",c.getId()).param("date",DAY.toString()).header("Authorization",auth(teacher))
            .contentType("application/json").content(json.writeValueAsString(extra))).andExpect(status().isOk());
        var row=sources.live(c,DAY).students().get(0);
        assertEquals("남",row.gender());assertEquals("등록학교",row.school());assertEquals("등록주소",row.address());assertEquals("010-0000-0031",row.phone());
        attendance.saveBatch(new AttendanceBatchRequest(c.getId(),DAY,List.of(new AttendanceBatchRequest.Record(student.getId(),"PRESENT","",""))),teacher.getId());
        attendance.submitReport(c.getId(),DAY,teacher.getId());
        student.update(student.getName(),"여",null,"변경된등록학교",student.getPhone(),null,null,null,null,null,student.getAddress(),null);students.saveAndFlush(student);
        assertEquals("변경된등록학교",sources.live(c,DAY).students().get(0).school());
        assertEquals("등록학교",sources.source(daily.findFirstByClassGroupIdAndReportDateOrderByIdAsc(c.getId(),DAY).orElseThrow()).students().get(0).school());
        attendance.submitReport(c.getId(),DAY,teacher.getId());
        assertEquals("변경된등록학교",sources.source(daily.findFirstByClassGroupIdAndReportDateOrderByIdAsc(c.getId(),DAY).orElseThrow()).students().get(0).school());
        http.perform(get("/api/classes").header("Authorization",auth(teacher))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(c.getId()));
        http.perform(get("/api/weekly-reports/classes/{id}",unrelated.getId()).param("date",DAY.toString()).header("Authorization",auth(teacher))).andExpect(status().isForbidden());
        http.perform(put("/api/weekly-reports/classes/{id}",unrelated.getId()).param("date",DAY.toString()).header("Authorization",auth(teacher))
            .contentType("application/json").content(json.writeValueAsString(extra))).andExpect(status().isForbidden());
    }
}
