package com.newaveflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.dto.report.NewFamilyDto.*;
import com.newaveflow.dto.report.WeeklyReportDto.*;
import com.newaveflow.dto.attendance.AttendanceBatchRequest;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class NewFamilyHttpTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired JwtTokenProvider tokens;
    @Autowired NewFamilyService family;
    @Autowired WeeklyReportService weekly;
    @Autowired WeeklyReportSourceService sources;
    @Autowired WeeklyReportDocumentService documents;
    @Autowired AttendanceService attendance;
    @Autowired ClassService classService;
    @Autowired StudentService studentService;
    @Autowired UserRepository users;
    @Autowired CommunityAgreementRepository agreements;
    @Autowired ClassGroupRepository classes;
    @Autowired TeacherClassRepository teachers;
    @Autowired StudentRepository students;
    @Autowired NewFamilyMemberRepository members;
    @Autowired jakarta.persistence.EntityManager em;
    final LocalDate day=LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
    User user(String name,User.Role role){var u=users.saveAndFlush(User.builder().name(name).email(UUID.randomUUID()+"@example.invalid").password("synthetic").role(role).gender("남").build());agreements.saveAndFlush(new CommunityAgreement(u.getId(),CommunitySafetyService.POLICY_VERSION));return u;}
    String auth(User u){return "Bearer "+tokens.createAccessToken(u.getId(),u.getEmail(),u.getRole().name(),u.getAuthVersion());}
    Profile profile(String name){return new Profile(name,"중1","여","가상학교","010-0000-0000","가상 주소","가상인도자");}
    Person create(String name,LocalDate date,User u){return family.create(new Create(profile(name),date,false),u);}
    ClassGroup group(User u,String grade){var c=classes.saveAndFlush(ClassGroup.builder().name("가상 "+grade+"반").ageGroup(grade).build());teachers.saveAndFlush(TeacherClass.builder().classGroup(c).teacher(u).isPrimary(true).build());return c;}
    void submit(LocalDate date,User u,Person... people){var w=family.week(date,u);var checks=Arrays.stream(people).map(p->new Check(p.id(),"PRESENT")).toList();w=family.saveChecks(date,new AttendanceInput(w.sourceHash(),checks),u);family.submit(date,new Submit(w.sourceHash()),u);}
    List<StudentRow> teamRows(LocalDate date){return weekly.get(date).classes().stream().filter(c->c.classId()<0&&c.submitted()).flatMap(c->c.students().stream()).toList();}
    @Test void scopesTeamAccessAndRevokesItImmediately()throws Exception {
        var admin=user("가상관리",User.Role.ADMIN);var team=user("가상팀원",User.Role.TEACHER);var other=user("가상일반",User.Role.TEACHER);var executive=user("가상임원",User.Role.EXECUTIVE);
        for(var u:List.of(team,other,executive))http.perform(get("/api/new-family/people").header("Authorization",auth(u))).andExpect(status().isForbidden());
        http.perform(put("/api/new-family/team/{id}",team.getId()).header("Authorization",auth(other)).contentType("application/json").content("{\"member\":true}")).andExpect(status().isForbidden());
        http.perform(put("/api/new-family/team/{id}",team.getId()).header("Authorization",auth(admin)).contentType("application/json").content("{\"member\":true}")).andExpect(status().isOk());
        http.perform(get("/api/new-family/people").header("Authorization",auth(team))).andExpect(status().isOk());
        http.perform(put("/api/new-family/people/999/assignment").header("Authorization",auth(team)).contentType("application/json").content("{\"revision\":0,\"classId\":1,\"effectiveDate\":\"2030-01-01\"}")).andExpect(status().isForbidden());
        family.setTeam(team.getId(),new TeamInput(false),admin);
        http.perform(get("/api/new-family/people").header("Authorization",auth(team))).andExpect(status().isForbidden());
        http.perform(get("/api/new-family/people")).andExpect(status().isUnauthorized());
    }
    @Test void firstVisitRegistrationFollowupAndFamilyAreMutuallyExclusiveAndFrozen()throws Exception {
        var admin=user("가상관리",User.Role.ADMIN);
        var first=create("가상첫방문",day.minusWeeks(2),admin);
        submit(day.minusWeeks(2),admin,first);
        assertEquals("FIRST",teamRows(day.minusWeeks(2)).get(0).category());
        submit(day.minusWeeks(1),admin,first);
        assertEquals("FOLLOWUP",teamRows(day.minusWeeks(1)).get(0).category());
        assertTrue(documents.html(weekly.get(day.minusWeeks(1))).contains("등록 미정 재방문 1명"));
        first=family.enroll(first.id(),new Enroll(first.revision(),day,"등록 의사 확인"),admin);
        submit(day,admin,first);
        assertEquals("FAMILY",teamRows(day).get(0).category());
        assertEquals("FIRST",teamRows(day.minusWeeks(2)).get(0).category());
        assertEquals("FOLLOWUP",teamRows(day.minusWeeks(1)).get(0).category());
        var newcomer=create("가상당일등록",day,admin);newcomer=family.enroll(newcomer.id(),new Enroll(newcomer.revision(),day,""),admin);
        submit(day,admin,first,newcomer);
        assertEquals(List.of("FAMILY","FIRST"),teamRows(day).stream().map(StudentRow::category).sorted().toList());
        // HWPX preserves the original template and includes family/first/total exactly once.
        var helper=new WeeklyReportHttpTest();var hwpx=documents.hwpx(weekly.get(day));
        assertEquals("1",helper.cell(hwpx,10,14));assertEquals("1",helper.cell(hwpx,10,19));assertEquals("2",helper.cell(hwpx,10,27));
        var followup=documents.hwpx(weekly.get(day.minusWeeks(1)));assertEquals("0",helper.cell(followup,10,19));assertEquals("0",helper.cell(followup,10,14));assertEquals("1",helper.cell(followup,10,27));
        try(var pdf=org.apache.pdfbox.Loader.loadPDF(documents.pdf(weekly.get(day.minusWeeks(1))))){assertTrue(new org.apache.pdfbox.text.PDFTextStripper().getText(pdf).contains("등록 미정 재방문"));}
        // Live attendance never mutates the submitted snapshot; it demands resubmission.
        var w=family.week(day,admin);family.saveChecks(day,new AttendanceInput(w.sourceHash(),List.of(new Check(first.id(),"ABSENT"))),admin);
        assertTrue(family.week(day,admin).changed());assertTrue(teamRows(day).stream().allMatch(s->s.status().equals("PRESENT")));
        var r=weekly.get(day);assertTrue(r.issues().stream().anyMatch(i->i.message().contains("다시 제출")));
        final var oldHash=w.sourceHash();assertThrows(com.newaveflow.exception.AppException.class,()->family.submit(day,new Submit(oldHash),admin));
    }
    @Test void fourSessionsDoNotGraduateAndTeamCanDecideWithFewerSessions()throws Exception {
        var admin=user("가상관리",User.Role.ADMIN);var teacher=user("가상담임",User.Role.TEACHER);var team=user("가상팀",User.Role.TEACHER);family.setTeam(team.getId(),new TeamInput(true),admin);
        var c=group(teacher,"중1");var wrong=group(teacher,"중2");var p=create("가상과정",day.minusWeeks(4),team);long studentId=p.studentId();
        p=family.enroll(p.id(),new Enroll(p.revision(),day.minusWeeks(4),""),team);
        p=family.saveCourse(p.id(),new Course(p.revision(),List.of(day.minusWeeks(4),day.minusWeeks(3),day.minusWeeks(2),day.minusWeeks(1)),""),team);assertEquals("REVIEW",p.decision());
        final var pending=p;assertThrows(com.newaveflow.exception.AppException.class,()->family.requestAssignment(pending.id(),new Revision(pending.revision()),team));
        p=family.decide(p.id(),new Decision(p.revision(),"HOLD","적응 확인 필요",null),team);assertNull(p.graduatedOn());
        p=family.saveCourse(p.id(),new Course(p.revision(),Arrays.asList(day.minusWeeks(4),null,null,null),"이력 보완"),team);
        p=family.decide(p.id(),new Decision(p.revision(),"READY","개별 면담 후 팀 판단",day),team);assertEquals(1,p.course().stream().filter(Objects::nonNull).count());
        assertThrows(com.newaveflow.exception.AppException.class,()->studentService.assignStudentToClass(studentId,c.getId()));
        p=family.requestAssignment(p.id(),new Revision(p.revision()),team);
        final var requested=p;assertThrows(com.newaveflow.exception.AppException.class,()->family.assign(requested.id(),new Assign(requested.revision(),wrong.getId(),LocalDate.now(),""),admin));
        LocalDate effective=LocalDate.now().plusDays(1);p=family.assign(p.id(),new Assign(p.revision(),c.getId(),effective,"필요한 인계"),admin);
        assertEquals(studentId,p.studentId());assertEquals(1,students.count());assertEquals(c.getId(),p.classId());
        assertTrue(classService.getStudentsInClass(c.getId(),teacher,LocalDate.now()).isEmpty());
        assertTrue(classService.getStudentsInClass(c.getId(),teacher,effective).isEmpty());
        http.perform(get("/api/classes/{id}/students",c.getId()).param("date",effective.toString()).header("Authorization",auth(teacher))).andExpect(status().isOk()).andExpect(content().json("[]"));
        assertThrows(com.newaveflow.exception.AppException.class,()->attendance.saveBatch(new AttendanceBatchRequest(c.getId(),day,List.of(new AttendanceBatchRequest.Record(studentId,"PRESENT","",""))),teacher.getId()));
        assertEquals(1,family.week(day,team).people().size());
        // Simulate the date boundary without changing the clock: query/reconcile on the first assigned Sunday.
        var after=effective.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));var row=new StudentRow("student:"+studentId,studentId,p.profile().name(),"여","중1",c.getName(),"REGULAR","PRESENT",false,"","","","");
        var source=new ClassSource(c.getId(),c.getName(),"중1",teacher.getName(),1,true,false,false,null,List.of(row),"","");
        assertTrue(family.reconcile(source,after).students().get(0).graduated());assertFalse(family.reconcile(source,after.plusWeeks(1)).students().get(0).graduated());
    }
    @Test void referencesLinkOnceAndCannotBeReintroducedByTeacher()throws Exception {
        var admin=user("가상관리",User.Role.ADMIN);var teacher=user("가상담임",User.Role.TEACHER);var c=group(teacher,"중1");
        var regular=students.saveAndFlush(Student.builder().name("가상재적").grade("중1").gender("남").classGroup(c).build());
        var v=new Visitor("friend-1","가상방문","여","중1","가상학교","가상 주소","010-0000-0000","가상재적","PRESENT",false);
        sources.saveTeacherSupplement(c.getId(),day,new Supplement(List.of(),List.of(v),""),teacher);
        attendance.saveBatch(new AttendanceBatchRequest(c.getId(),day,List.of(new AttendanceBatchRequest.Record(regular.getId(),"PRESENT","",""))),teacher.getId());attendance.submitReport(c.getId(),day,teacher.getId());
        var p=create("가상방문",day,admin);
        assertThrows(com.newaveflow.exception.AppException.class,()->family.submit(day,new Submit(family.week(day,admin).sourceHash()),admin));
        family.link(day,new LinkInput(c.getId(),v.id(),p.id()),admin);submit(day,admin,p);
        var r=weekly.get(day);assertEquals(2,r.classes().stream().filter(ClassSource::submitted).flatMap(s->s.students().stream()).count());
        assertEquals(1,r.classes().stream().flatMap(s->s.students().stream()).filter(s->s.category().equals("FIRST")).count());
        var hwpx=documents.hwpx(r);var helper=new WeeklyReportHttpTest();assertEquals("1",helper.cell(hwpx,10,19));assertEquals("2",helper.cell(hwpx,10,27));
        sources.saveTeacherSupplement(c.getId(),day,new Supplement(List.of(),List.of(),""),teacher);
        assertEquals(1,sources.supplement(c.getId(),day).visitors().size());
        assertTrue(weekly.get(day).classes().stream().flatMap(s->s.students().stream()).noneMatch(s->s.id().startsWith("visitor:")));
        var other=create("가상다른방문",day,admin);assertThrows(com.newaveflow.exception.AppException.class,()->family.link(day,new LinkInput(c.getId(),v.id(),other.id()),admin));
    }
    @Test void assignedTeacherSubmissionMovesOneStudentIntoRegularAndGraduationTotals()throws Exception {
        var admin=user("가상관리",User.Role.ADMIN);var teacher=user("가상담임",User.Role.TEACHER);var team=user("가상팀",User.Role.TEACHER);
        family.setTeam(team.getId(),new TeamInput(true),admin);var c=group(teacher,"중1");
        var regular=students.saveAndFlush(Student.builder().name("가상기존").grade("중1").gender("남").classGroup(c).build());
        var p=create("가상등반",day.minusWeeks(4),team);p=family.enroll(p.id(),new Enroll(p.revision(),day.minusWeeks(4),""),team);
        p=family.decide(p.id(),new Decision(p.revision(),"READY","개별 판단",day),team);submit(day,team,p);
        attendance.saveBatch(new AttendanceBatchRequest(c.getId(),day,List.of(new AttendanceBatchRequest.Record(regular.getId(),"PRESENT","",""))),teacher.getId());attendance.submitReport(c.getId(),day,teacher.getId());
        var previousRows=weekly.get(day).classes();var effective=day.plusWeeks(1);long studentId=p.studentId();
        p=family.requestAssignment(p.id(),new Revision(p.revision()),team);family.assign(p.id(),new Assign(p.revision(),c.getId(),effective,"인계 확인"),admin);
        assertEquals(previousRows,weekly.get(day).classes());
        assertFalse(classService.getStudentsInClass(c.getId(),teacher,day).stream().anyMatch(s->s.id().equals(studentId)));
        try(var clock=org.mockito.Mockito.mockStatic(LocalDate.class,org.mockito.Mockito.CALLS_REAL_METHODS)) {
            clock.when(LocalDate::now).thenReturn(effective);
            assertEquals(2,classService.getStudentsInClass(c.getId(),teacher,effective).size());
            assertTrue(family.week(effective,team).people().isEmpty());
            assertEquals("인계 확인",family.handoff(studentId,teacher).memo());
            var batch=new AttendanceBatchRequest(c.getId(),effective,List.of(new AttendanceBatchRequest.Record(regular.getId(),"PRESENT","",""),new AttendanceBatchRequest.Record(studentId,"PRESENT","","")));
            http.perform(post("/api/attendance/batch").header("Authorization",auth(teacher)).contentType("application/json").content(json.writeValueAsString(batch))).andExpect(status().isOk());
            attendance.submitReport(c.getId(),effective,teacher.getId());
            var report=weekly.get(effective);var rows=report.classes().stream().flatMap(s->s.students().stream()).toList();
            assertEquals(2,rows.size());assertEquals(1,rows.stream().filter(s->s.studentId().equals(studentId)).count());
            assertTrue(rows.stream().allMatch(s->s.category().equals("REGULAR")));assertEquals(1,rows.stream().filter(StudentRow::graduated).count());
            var helper=new WeeklyReportHttpTest();var hwpx=documents.hwpx(report);
            assertEquals("2",helper.cell(hwpx,10,27));assertEquals("1",helper.cell(hwpx,10,30));assertEquals("0",helper.cell(hwpx,10,14));assertEquals("0",helper.cell(hwpx,10,19));
            assertEquals(previousRows,weekly.get(day).classes());
        }
    }
    @Test void rejectsStaleEditsFutureDatesAndDuplicateCreation()throws Exception {
        var admin=user("가상관리",User.Role.ADMIN);var p=create("가상검증",day,admin);
        http.perform(post("/api/new-family/people").header("Authorization",auth(admin)).contentType("application/json").content(json.writeValueAsString(new Create(profile("가상미래"),LocalDate.now().plusDays(1),false)))).andExpect(status().isBadRequest());
        http.perform(post("/api/new-family/people").header("Authorization",auth(admin)).contentType("application/json").content(json.writeValueAsString(new Create(profile("가상검증"),day,false)))).andExpect(status().isConflict());
        family.edit(p.id(),new Edit(p.revision(),profile("가상보완"),""),admin);
        http.perform(put("/api/new-family/people/{id}/enrollment",p.id()).header("Authorization",auth(admin)).contentType("application/json").content(json.writeValueAsString(new Enroll(p.revision(),day,"")))).andExpect(status().isConflict());
        http.perform(get("/api/new-family/weeks/{date}",day.plusDays(1)).header("Authorization",auth(admin))).andExpect(status().isBadRequest());
    }
}
