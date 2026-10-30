package com.newaveflow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.dto.attendance.AttendanceBatchRequest;
import com.newaveflow.dto.report.WeeklyReportDto.*;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import static com.newaveflow.service.WeeklyReportSourceService.*;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class WeeklyReportService {
    private final WeeklyReportSourceService sources;
    private final ObjectMapper json;
    private final ClassGroupRepository classes;
    private final DailyReportRepository reports;
    private final TeacherClassRepository assignments;
    private final UserRepository users;
    private final TeacherWorshipAttendanceRepository worship;
    private final WeeklyDepartmentReportRepository drafts;
    private final WeeklyReportExportRepository exports;
    private final AttendanceService attendance;
    private final AttendanceRepository attendanceRecords;
    private final WeeklyReportDocumentService documents;
    private final NewFamilyService newFamily;
    private static final Set<String> FIELDS=Set.of("department","singer","prayer","scripture","sermon","preacher","offering","notes","monthPlan","nextPlan","author","director","pastor","includeLate");

    public TeacherRow myWorship(LocalDate date,User user) {
        validateDate(date);
        var saved=worship.findByTeacherIdAndWorshipDate(user.getId(),date);
        if(saved.isPresent())return teacherRow(saved.get());
        return new TeacherRow(user.getId(),user.getName(),registeredGender(user),"UNKNOWN",0,null,"");
    }
    private String registeredGender(User user) {
        String value=gender(user.getGender());
        return value.isBlank()?worship.findFirstByTeacherIdOrderByWorshipDateDesc(user.getId()).map(r->gender(r.getGender())).orElse(""):value;
    }
    @Transactional
    public TeacherRow saveWorship(LocalDate date,Long teacherId,WorshipInput input,User actor) {
        validateDate(date);
        boolean own=actor.getId().equals(teacherId);
        if(!own&&!isAdmin(actor))throw AppException.forbidden("본인 출석만 입력할 수 있습니다.");
        var teacher=users.lockById(teacherId).orElseThrow(()->AppException.notFound("교사를 찾을 수 없습니다."));
        if(!teacher.isActive()||!teacher.participatesInTeacherActivities())throw AppException.badRequest("보고 대상 교사를 확인해주세요.");
        if(input==null||!Set.of("PRESENT","ABSENT").contains(input.status()==null?"":input.status()))
            throw AppException.badRequest("청소년부 예배 참석 여부를 선택해주세요.");
        String reportGender=own?registeredGender(teacher):gender(input.gender());
        if(own&&reportGender.isBlank())reportGender=gender(input.gender()); // Older clients may still supply it.
        if(!own&&reportGender.isBlank())throw AppException.badRequest("교사 개인정보의 성별을 확인해주세요.");
        String reason=text(input.reason(),500);
        if(!own&&reason.isBlank())throw AppException.badRequest("관리자 보완 사유를 입력해주세요.");
        var row=worship.findByTeacherIdAndWorshipDate(teacherId,date).orElseGet(TeacherWorshipAttendance::new);
        row.setTeacher(teacher);row.setWorshipDate(date);row.setGender(reportGender);row.setStatus(input.status());
        row.setRevision(row.getRevision()+1);row.setUpdatedAt(LocalDateTime.now());row.setUpdatedBy(actor.getId());row.setCorrectionReason(reason);
        return teacherRow(worship.save(row));
    }
    private TeacherRow teacherRow(TeacherWorshipAttendance r) {return new TeacherRow(r.getTeacher().getId(),r.getTeacher().getName(),r.getGender().isBlank()?gender(r.getTeacher().getGender()):r.getGender(),r.getStatus(),r.getRevision(),r.getUpdatedAt(),r.getCorrectionReason());}
    private static boolean isAdmin(User u) {return u!=null&&Set.of(User.Role.ADMIN,User.Role.PASTOR,User.Role.EXECUTIVE).contains(u.getRole());}

    public Report get(LocalDate date) {
        validateDate(date);
        var draft=drafts.findByReportDate(date).orElse(null);
        Map<String,String> fields=new TreeMap<>();fields.put("department","청소년부");fields.put("includeLate","true");
        if(draft!=null)try {fields.putAll(json.readValue(draft.getFieldsJson(),new TypeReference<Map<String,String>>(){}));}catch(Exception e){throw new IllegalStateException(e);}
        Map<Long,DailyReport> saved=reports.findByDateWithDetails(date).stream().collect(Collectors.toMap(r->r.getClassGroup().getId(),r->r));
        var assigned=assignments.findAllWithTeacherAndClass().stream().map(a->a.getClassGroup().getId()).collect(Collectors.toSet());
        List<ClassSource> classRows=new ArrayList<>();
        for(var group:classes.findAll()) {
            var row=newFamily.reconcile(saved.containsKey(group.getId())?sources.source(saved.get(group.getId())):sources.live(group,date),date);
            if(!row.students().isEmpty()||assigned.contains(group.getId())||saved.containsKey(group.getId()))classRows.add(row);
        }
        classRows.addAll(newFamily.reportSources(date));
        classRows.sort(Comparator.comparing((ClassSource c)->Objects.toString(c.grade(),"")).thenComparing(ClassSource::className).thenComparing(ClassSource::classId));
        Map<Long,TeacherWorshipAttendance> checks=worship.findByWorshipDate(date).stream().collect(Collectors.toMap(r->r.getTeacher().getId(),r->r));
        List<TeacherRow> teachers=users.findAllActiveWithClasses().stream().filter(User::participatesInTeacherActivities)
                .sorted(Comparator.comparing(User::getName).thenComparing(User::getId))
                .map(u->checks.containsKey(u.getId())?teacherRow(checks.get(u.getId())):new TeacherRow(u.getId(),u.getName(),gender(u.getGender()),"UNKNOWN",0,null,""))
                .toList();
        List<Issue> issues=validate(classRows,teachers,fields);
        issues.addAll(newFamily.reportIssues(date));
        long revision=draft==null?-1:draft.getRevision();
        String hash=digest(sources.encode(List.of(date,revision,fields,classRows,teachers)));
        return new Report(date,revision,hash,fields,classRows,teachers,issues,
                exports.findByReportDateOrderByCreatedAtDesc(date).stream().map(e->new ExportView(e.getId(),e.getCreatedAt(),e.getCreatedBy())).toList());
    }
    private List<Issue> validate(List<ClassSource> classes,List<TeacherRow> teachers,Map<String,String> fields) {
        List<Issue> issues=new ArrayList<>();Set<String> seen=new HashSet<>();Set<String> contacts=new HashSet<>();
        if(classes.isEmpty())issues.add(new Issue("roster",null,"보고 대상 반이 없습니다. 반 배정을 확인해주세요."));
        if(teachers.isEmpty())issues.add(new Issue("roster",null,"보고 대상 교사가 없습니다."));
        for(var c:classes) {
            if(c.teacherName().isBlank())issues.add(new Issue("class",c.classId(),c.className()+" 담임 배정 확인 필요"));
            if(!Set.of("중1","중2","중3","고1","고2","고3").contains(WeeklyReportDocumentService.grade(c.grade())))issues.add(new Issue("class",c.classId(),c.className()+" 학년을 중1~고3으로 지정해주세요."));
            if(!c.submitted())issues.add(new Issue("class",c.classId(),c.className()+" 출석 미제출"));
            if(c.changed())issues.add(new Issue("class",c.classId(),c.className()+" 수정 중 · 다시 제출해야 합니다."));
            for(var s:c.students()) {
                if(awaitsNewFamilyTeam(s))issues.add(new Issue("class",c.classId(),s.name()+" 첫 방문 · 새가족팀 출결 확인 필요 (집계 대기)"));
                if(!seen.add(s.id()))issues.add(new Issue("class",c.classId(),s.name()+" 중복 집계 대상 · 반 배정을 확인해주세요."));
                if("UNKNOWN".equals(s.status()))issues.add(new Issue("class",c.classId(),s.name()+" 출석 미확인"));
                if(s.gender().isBlank())issues.add(new Issue("class",c.classId(),s.name()+" 성별 미입력"));
                if(s.category().equals("FIRST")) {
                    if(List.of(s.name(),s.grade(),s.school(),s.address(),s.phone(),s.introducer()).stream().anyMatch(String::isBlank))
                        issues.add(new Issue("class",c.classId(),s.name()+" 새 방문자 필수 정보 보완"));
                    if(!s.phone().isBlank()&&!contacts.add(s.name()+"|"+s.phone().replaceAll("[^0-9]","")))
                        issues.add(new Issue("class",c.classId(),s.name()+" 새 방문자 중복 가능 · 담당 반에서 확인해주세요."));
                }
            }
        }
        for(var t:teachers) {
            if(t.status().equals("UNKNOWN"))issues.add(new Issue("teacher",t.id(),t.name()+" 청소년부 예배 출석 확인 필요"));
            if(t.gender().isBlank())issues.add(new Issue("teacher",t.id(),t.name()+" 개인정보 성별 보완 필요"));
        }
        Map.of("scripture","성경 본문","sermon","설교 제목","preacher","설교자","author","담당자","director","교육부총괄","pastor","담임목사")
                .forEach((key,label)->{if(fields.getOrDefault(key,"").isBlank())issues.add(new Issue("common",null,label+" 미입력"));});
        if(!fields.getOrDefault("offering","").matches("[0-9]{1,12}"))issues.add(new Issue("common",null,"헌금은 0 이상의 정수로 입력해주세요."));
        return issues;
    }
    @Transactional
    public Report saveDraft(LocalDate date,DraftInput input) {
        validateDate(date);
        if(input==null||input.revision()==null||input.fields()==null)throw AppException.badRequest("보고서 내용을 확인해주세요.");
        var row=drafts.findByReportDate(date).orElse(null);
        if((row==null?-1:row.getRevision())!=input.revision())throw AppException.conflict("다른 담당자가 수정했습니다. 최신 내용을 확인해주세요.");
        Map<String,String> fields=new TreeMap<>();
        for(var e:input.fields().entrySet()) {
            if(!FIELDS.contains(e.getKey()))throw AppException.badRequest("지원하지 않는 보고서 항목입니다.");
            fields.put(e.getKey(),text(e.getValue(),Set.of("notes","monthPlan","nextPlan").contains(e.getKey())?6000:500));
        }
        if(!Set.of("true","false").contains(fields.getOrDefault("includeLate","true")))throw AppException.badRequest("지각 합산 기준을 확인해주세요.");
        if(row==null){row=new WeeklyDepartmentReport();row.setReportDate(date);}
        row.setFieldsJson(sources.encode(fields));drafts.saveAndFlush(row);
        return get(date);
    }
    @Transactional
    public Report correctClass(Long classId,LocalDate date,CorrectionInput input,User actor) {
        validateDate(date);
        if(!isAdmin(actor))throw AppException.forbidden("관리자만 보완할 수 있습니다.");
        if(input==null||text(input.reason(),500).isBlank())throw AppException.badRequest("보완 사유를 입력해주세요.");
        classes.lockById(classId).orElseThrow(()->AppException.notFound("반을 찾을 수 없습니다."));
        var editor=sources.editor(classId,date,actor);
        if(!Objects.equals(input.sourceHash(),editor.sourceHash()))throw AppException.conflict("반 자료가 변경되었습니다. 보완 창을 닫고 최신 자료를 다시 확인해주세요.");
        var existing=editor.students().stream().filter(s->s.studentId()!=null).toList();
        if(input.attendance()==null||input.attendance().size()!=existing.size())throw AppException.badRequest("반 전체 출석을 확인해주세요.");
        var recorded=attendanceRecords.findByClassGroupIdAndAttendanceDate(classId,date).stream().collect(Collectors.toMap(a->a.getStudent().getId(),a->a));
        var items=existing.stream().map(s->{var a=recorded.get(s.studentId());return new AttendanceBatchRequest.Record(s.studentId(),input.attendance().get(s.id()),a==null?"":a.getAbsentReason(),a==null?"":a.getNote());}).toList();
        if(items.stream().anyMatch(i->i.status()==null||!Set.of("PRESENT","ABSENT","LATE").contains(i.status())))throw AppException.badRequest("모든 학생의 출석을 확인해주세요.");
        sources.saveSupplement(classId,date,input.supplement(),actor);
        attendance.saveBatch(new AttendanceBatchRequest(classId,date,items),actor.getId());
        attendance.submitReport(classId,date,actor.getId());
        var report=reports.findFirstByClassGroupIdAndReportDateOrderByIdAsc(classId,date).orElseThrow();
        report.recordCorrection(actor.getName()+": "+text(input.reason(),500));
        return get(date);
    }
    @Transactional(isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public ExportView prepare(LocalDate date,ExportRequest request,User actor) {
        var report=get(date);
        if(request==null||request.draftRevision()!=report.draftRevision()||!Objects.equals(request.sourceHash(),report.sourceHash()))
            throw AppException.conflict("새 제출 또는 수정 내용이 있습니다. 최신 집계를 확인한 뒤 다운로드해주세요.");
        if(!report.issues().isEmpty())throw AppException.badRequest("누락된 항목을 보완한 뒤 파일을 만들어주세요.");
        documents.validateCapacity(report);
        // Check text renderability before recording an output that promises both formats.
        documents.pdf(report);
        var archived=new WeeklyReportExport();archived.setReportDate(date);archived.setPayload(sources.encode(report));archived.setSourceHash(report.sourceHash());
        archived.setTemplateVersion("church-250622-v1");archived.setCreatedAt(LocalDateTime.now());archived.setCreatedBy(actor.getName());
        exports.save(archived);return new ExportView(archived.getId(),archived.getCreatedAt(),archived.getCreatedBy());
    }
    public Report exported(Long id) {return sources.decode(exports.findById(id).orElseThrow(()->AppException.notFound("출력본을 찾을 수 없습니다.")).getPayload(),Report.class);}
    private String digest(String value) {try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
}
