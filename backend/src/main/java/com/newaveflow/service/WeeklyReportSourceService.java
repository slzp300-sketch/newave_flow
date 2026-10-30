package com.newaveflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.dto.report.WeeklyReportDto.*;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class WeeklyReportSourceService {
    private final ObjectMapper json;
    private final StudentRepository students;
    private final AttendanceRepository attendance;
    private final ClassGroupRepository classes;
    private final TeacherClassRepository assignments;
    private final DailyReportRepository reports;
    private final WeeklyClassSupplementRepository supplements;
    private final ClassAccessService access;
    private final NewFamilyService newFamily;

    public static void validateDate(LocalDate date) {
        if(date==null || date.getDayOfWeek()!=DayOfWeek.SUNDAY || date.isAfter(LocalDate.now()))
            throw AppException.badRequest("이번 주 또는 지난 주의 주일을 선택해주세요.");
    }
    public static String text(String value,int max) {
        String result=value==null?"":value.trim();
        if(result.length()>max) throw AppException.badRequest("입력한 내용이 허용 길이를 넘었습니다.");
        if(result.codePoints().anyMatch(c->c<32&&c!='\n'&&c!='\t'&&c!='\r')) throw AppException.badRequest("사용할 수 없는 문자가 있습니다.");
        return result;
    }
    public static String gender(String value) {
        String v=text(value,10);
        return switch(v) { case "M","MALE","남자","남성","남" -> "남"; case "F","FEMALE","여자","여성","여" -> "여"; default -> ""; };
    }
    private static String category(String value) {
        String v=value==null?"REGULAR":value;
        if(!Set.of("REGULAR","FAMILY","FIRST","RETURN").contains(v)) throw AppException.badRequest("보고 구분을 확인해주세요.");
        return v;
    }
    private static String status(String value) {
        String v=value==null?"UNKNOWN":value;
        if(!Set.of("PRESENT","LATE","ABSENT","UNKNOWN").contains(v)) throw AppException.badRequest("출석 상태를 확인해주세요.");
        return v;
    }
    public String encode(Object data) { try { return json.writeValueAsString(data); } catch(Exception e) { throw new IllegalStateException("Report serialization failed",e); } }
    public <T>T decode(String data,Class<T> type) { try { return json.readValue(data,type); } catch(Exception e) { throw new IllegalStateException("Stored report data is invalid",e); } }
    public Supplement supplement(Long id,LocalDate date) {
        return supplements.findByClassGroupIdAndReportDate(id,date).map(row->decode(row.getPayload(),Supplement.class))
                .orElse(new Supplement(List.of(),List.of(),""));
    }
    @Transactional
    public Supplement saveTeacherSupplement(Long id,LocalDate date,Supplement input,User user) {
        validateDate(date); access.requireClass(user,id);
        classes.lockById(id).orElseThrow(()->AppException.notFound("반을 찾을 수 없습니다."));
        if(input==null)throw AppException.badRequest("보고서 추가 정보를 확인해주세요.");
        var previous=supplement(id,date);
        var roster=students.findByClassGroupIdAndIsActiveTrue(id);
        var allowed=roster.stream().map(Student::getId).collect(Collectors.toSet());
        Set<Long> seen=new HashSet<>();
        if(input.members()!=null)for(var m:input.members()) {
            if(m==null||!allowed.contains(m.studentId())||!seen.add(m.studentId()))throw AppException.badRequest("해당 반 학생을 중복 없이 선택해주세요.");
        }
        var savedMembers=previous.members().stream().collect(Collectors.toMap(Member::studentId,Function.identity()));
        // Teachers check attendance; team/admin classifications survive even an omitted or stale member list.
        var members=roster.stream().map(s->{
            var m=savedMembers.get(s.getId());
            return new Member(s.getId(),m==null?"REGULAR":m.category(),m!=null&&m.graduated(),"","","","",m==null?"":m.introducer(),true);
        }).toList();
        var savedVisitors=previous.visitors().stream().collect(Collectors.toMap(Visitor::id,Function.identity()));
        var visitors=new ArrayList<>(input.visitors()==null?List.<Visitor>of():input.visitors().stream().map(v->{
            var clean=cleanVisitor(v);
            if(clean.name().isBlank())throw AppException.badRequest("처음 온 학생의 이름을 입력해주세요.");
            var old=savedVisitors.get(clean.id());
            // Team-confirmed records are read-only here, including when a stale teacher form is submitted.
            if(old!=null&&(!Boolean.FALSE.equals(old.teamConfirmed())||newFamily.linkedReference(id,date,old.id())))return old;
            return new Visitor(clean.id(),clean.name(),clean.gender(),clean.grade(),clean.school(),clean.address(),clean.phone(),clean.introducer(),clean.status(),false);
        }).toList());
        var suppliedIds=visitors.stream().map(Visitor::id).collect(Collectors.toSet());
        previous.visitors().stream().filter(v->(!Boolean.FALSE.equals(v.teamConfirmed())||newFamily.linkedReference(id,date,v.id()))&&!suppliedIds.contains(v.id())).forEach(visitors::add);
        return saveSupplement(id,date,new Supplement(members,visitors,input.notes()),user);
    }
    private static Visitor cleanVisitor(Visitor v) {
        if(v==null)throw AppException.badRequest("처음 온 학생 정보를 확인해주세요.");
        return new Visitor(text(v.id(),60),text(v.name(),50),gender(v.gender()),text(v.grade(),20),text(v.school(),100),text(v.address(),255),text(v.phone(),30),text(v.introducer(),100),status(v.status()),v.teamConfirmed());
    }
    public static boolean awaitsNewFamilyTeam(StudentRow row) {return Boolean.FALSE.equals(row.teamConfirmed());}
    @Transactional
    public Supplement saveSupplement(Long id,LocalDate date,Supplement input,User user) {
        validateDate(date); access.requireClass(user,id);
        var group=classes.lockById(id).orElseThrow(()->AppException.notFound("반을 찾을 수 없습니다."));
        if(input==null)throw AppException.badRequest("보고서 추가 정보를 확인해주세요.");
        var memberInputs=input.members()==null?List.<Member>of():input.members();
        var visitorInputs=input.visitors()==null?List.<Visitor>of():input.visitors();
        if(memberInputs.size()>500||visitorInputs.size()>100)throw AppException.badRequest("한 번에 입력할 수 있는 인원을 초과했습니다.");
        Set<Long> allowed=students.findByClassGroupIdAndIsActiveTrue(id).stream().map(Student::getId).collect(Collectors.toSet());
        Set<Long> seen=new HashSet<>(); List<Member> members=new ArrayList<>();
        for(var m:memberInputs) {
            if(m==null||m.studentId()==null||!allowed.contains(m.studentId())||!seen.add(m.studentId()))throw AppException.badRequest("해당 반 학생을 중복 없이 선택해주세요.");
            String cat=category(m.category());
            if(m.graduated()&&!cat.equals("REGULAR"))throw AppException.badRequest("등반자는 재적에 포함해 한 번만 집계합니다.");
            members.add(new Member(m.studentId(),cat,m.graduated(),gender(m.gender()),text(m.school(),100),text(m.address(),255),text(m.phone(),30),text(m.introducer(),100),m.profileLinked()));
        }
        List<Visitor> visitors=new ArrayList<>();Set<String> visitorIds=new HashSet<>();
        for(var v:visitorInputs) {
            if(v==null)throw AppException.badRequest("새 방문자 정보를 확인해주세요.");
            String key=text(v.id(),60);if(key.isEmpty())key=UUID.randomUUID().toString();
            if(!key.matches("[A-Za-z0-9-]+")||!visitorIds.add(key))throw AppException.badRequest("새 방문자가 중복되었습니다.");
            var clean=cleanVisitor(v);
            visitors.add(new Visitor(key,clean.name(),clean.gender(),clean.grade(),clean.school(),clean.address(),clean.phone(),clean.introducer(),clean.status(),clean.teamConfirmed()));
        }
        var value=new Supplement(members,visitors,text(input.notes(),3000));
        var row=supplements.findByClassGroupIdAndReportDate(id,date).orElseGet(WeeklyClassSupplement::new);
        row.setClassGroup(group);row.setReportDate(date);row.setPayload(encode(value));supplements.save(row);
        reports.findFirstByClassGroupIdAndReportDateOrderByIdAsc(id,date).ifPresent(DailyReport::markDraftChanged);
        return value;
    }
    public ClassEditor editor(Long id,LocalDate date,User user) {
        validateDate(date);access.requireClass(user,id);
        var group=classes.findById(id).orElseThrow(()->AppException.notFound("반을 찾을 수 없습니다."));
        var live=live(group,date);
        var report=reports.findFirstByClassGroupIdAndReportDateOrderByIdAsc(id,date).orElse(null);
        String fingerprint=encode(Arrays.asList(live,supplement(id,date),report==null?null:report.getUpdatedAt(),report==null?null:report.getSubmissionRevision()));
        try {
            String hash=HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(fingerprint.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
            return new ClassEditor(id,group.getName(),group.getAgeGroup(),date,supplement(id,date),live.students(),hash);
        } catch(java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    public ClassSource live(ClassGroup group,LocalDate date) {
        var extra=supplement(group.getId(),date);
        Map<Long,Member> member=extra.members().stream().collect(Collectors.toMap(Member::studentId,Function.identity()));
        Map<Long,Attendance> recorded=attendance.findByClassGroupIdAndAttendanceDate(group.getId(),date).stream()
                .collect(Collectors.toMap(a->a.getStudent().getId(),Function.identity()));
        List<StudentRow> rows=new ArrayList<>();
        for(var student:students.findByClassGroupIdAndIsActiveTrue(group.getId())) {
            if(!student.belongsToClassOn(date))continue;
            var m=member.get(student.getId());var a=recorded.get(student.getId());
            boolean linked=m==null||m.profileLinked();
            rows.add(new StudentRow("student:"+student.getId(),student.getId(),student.getName(),gender(pick(linked?null:m.gender(),student.getGender())),
                    pick(student.getGrade(),group.getAgeGroup()),group.getName(),m==null?"REGULAR":m.category(),a==null?"UNKNOWN":a.getStatus().name(),m!=null&&m.graduated(),
                    pick(linked?null:m.school(),student.getSchool()),pick(linked?null:m.address(),student.getAddress()),pick(linked?null:m.phone(),student.getPhone()),m==null?"":m.introducer()));
        }
        for(var v:extra.visitors()) rows.add(new StudentRow("visitor:"+v.id(),null,v.name(),v.gender(),v.grade(),group.getName(),"FIRST",v.status(),false,v.school(),v.address(),v.phone(),v.introducer(),v.teamConfirmed()));
        rows.sort(Comparator.comparing(StudentRow::name).thenComparing(StudentRow::id));
        String teacher=assignments.findAllWithTeacherAndClass().stream().filter(a->a.isPrimary()&&a.getClassGroup().getId().equals(group.getId()))
                .map(a->a.getTeacher().getName()).findFirst().orElse("");
        return newFamily.reconcile(new ClassSource(group.getId(),group.getName(),group.getAgeGroup(),teacher,0,false,false,false,null,rows,extra.notes(),""),date);
    }
    private static String pick(String preferred,String fallback) {return preferred!=null&&!preferred.isBlank()?preferred:(fallback==null?"":fallback);}
    public ClassSource source(DailyReport report) {
        if(report.getSubmittedData()!=null) {
            var saved=decode(report.getSubmittedData(),ClassSource.class);
            return new ClassSource(saved.classId(),saved.className(),saved.grade(),saved.teacherName(),report.getSubmissionRevision(),true,
                    report.isDraftChanged(),false,report.getSubmittedAt(),saved.students(),report.isNotesHidden()?"":saved.notes(),report.getCorrectionReason());
        }
        var live=live(report.getClassGroup(),report.getReportDate());
        return new ClassSource(live.classId(),live.className(),live.grade(),live.teacherName(),0,report.getStatus()==DailyReport.Status.SUBMITTED,
                report.isDraftChanged(),report.getStatus()==DailyReport.Status.SUBMITTED,report.getSubmittedAt(),live.students(),report.isNotesHidden()?"":notes(live.notes(),report.getSpecialNotes()),report.getCorrectionReason());
    }
    @Transactional
    public void capture(DailyReport report) {
        var live=live(report.getClassGroup(),report.getReportDate());
        var frozen=new ClassSource(live.classId(),live.className(),live.grade(),live.teacherName(),report.getSubmissionRevision()+1,true,false,false,
                report.getSubmittedAt(),live.students(),report.isNotesHidden()?"":notes(live.notes(),report.getSpecialNotes()),"");
        report.captureSubmission(encode(frozen));
    }
    private String notes(String first,String second) {
        return java.util.stream.Stream.of(first,second).filter(s->s!=null&&!s.isBlank()).distinct().collect(Collectors.joining("\n"));
    }
}
