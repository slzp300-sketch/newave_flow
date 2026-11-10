package com.newaveflow.service;

import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class GradeCareService {
 private final OfficerAccessService access;
 private final TeacherClassRepository assignments;
 private final StudentRepository students;
 private final ClassGroupRepository classes;
 private final UserRepository users;
 private final AttendanceRepository attendance;
 private final DailyReportRepository reports;
 private final WeeklyReportSourceService sources;
 private final NewFamilyService newFamily;
 private final TeacherWorshipAttendanceRepository worship;
 private final MeetingAttendanceRepository meetings;
 private final MeetingMinuteRepository minutes;
 private final MeetingMinuteConfirmRepository confirms;
 private final EventRepository events;
 private final EventRosterService eventRoster;
 private final StudentCareRecordRepository records;
 private final StudentCareChangeRepository changes;
 public static final List<String> GRADES=List.of("중1","중2","중3","고1","고2","고3");
 private static final Set<String> KINDS=Set.of("UPDATE","PRAYER","CONTACT");
 public record Capability(boolean canOverview,List<String> grades,List<String> assignedGrades,int activeYear){}
 public record Person(Long id,String name,String context){}
 public record History(LocalDate date,String status){}
 public record Pupil(Long id,String name,String grade,Long classId,String className,String school,boolean canCare,List<History> history,int prayerCount){}
 public record ClassCheck(Long id,String name,String teacher,String status,LocalDateTime submittedAt,int total,int present,int absent,int late,int unknown){}
 public record TeacherCheck(Long id,String name,String context,String worship,LocalDateTime worshipUpdated,String meeting,String reason,LocalDateTime meetingUpdated,String minute){}
 public record EventChoice(Long id,String title,LocalDate date,LocalDate endDate,String target){}
 public record EventPerson(Long id,String name,String context,String status,String reason,LocalDate partialFrom,String partialNote){}
 public record EventCheck(EventChoice event,List<EventPerson> teachers,List<EventPerson> students){}
 public record Overview(String grade,LocalDate date,LocalDate meetingDate,List<ClassCheck> classes,List<TeacherCheck> teachers,List<Pupil> students,List<EventChoice> events){}
 public record Change(Long id,Long recordId,String actor,String action,LocalDateTime at){}
 public record CareNote(Long id,long revision,String kind,String content,boolean followUp,LocalDateTime followedAt,boolean closed,String author,Long authorId,LocalDateTime createdAt,LocalDateTime updatedAt,boolean canEdit){}
 public record Detail(Pupil student,List<Person> teachers,List<CareNote> records,List<Change> changes){}
 public record NoteInput(Long revision,String kind,String content,Boolean followUp){}

 public Capability capability(User actor){var u=access.current(actor);var own=ownGrades(u);return new Capability(access.common(u),access.common(u)?GRADES:List.of(),own,access.activeYear());}
 private List<String> ownGrades(User u){return access.positions(u).stream().map(p->p.grade).filter(Objects::nonNull).distinct().toList();}
 private static String grade(String value){return WeeklyReportDocumentService.grade(value);}
 private static String studentGrade(Student s){String g=s.getClassGroup()==null?"":grade(s.getClassGroup().getAgeGroup());return GRADES.contains(g)?g:grade(s.getGrade());}
 private static String name(User u){return u==null?"탈퇴한 담당자":u.getName();}
 private static LocalDate today(){return LocalDate.now(OfficerAccessService.ZONE);}
 private static LocalDateTime now(){return LocalDateTime.now(OfficerAccessService.ZONE);}
 private LocalDate date(LocalDate d){if(d==null)d=today().with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));if(d.getDayOfWeek()!=DayOfWeek.SUNDAY||d.isAfter(today())||d.isBefore(LocalDate.of(2000,1,1)))throw AppException.badRequest("이번 주 또는 지난 주 주일을 선택해주세요.");return d;}
 private String checkGrade(String g){if(!GRADES.contains(g))throw AppException.badRequest("학년을 확인해주세요.");return g;}
 private User requireOverview(User actor){var u=access.current(actor);if(!access.common(u))throw AppException.forbidden("임원만 학년 현황을 확인할 수 있습니다.");return u;}
 private Student student(Long id){var s=students.findById(id).orElseThrow(()->AppException.notFound("학생을 찾을 수 없습니다."));if(!s.isActive()||!s.belongsToClassOn(today()))throw AppException.notFound("현재 반에 배정된 학생을 확인해주세요.");return s;}
 private boolean canCare(User u,Student s,List<TeacherClass> assigned,List<String> grades){return access.all(u)||grades.contains(studentGrade(s))||assigned.stream().anyMatch(a->a.getTeacher().getId().equals(u.getId())&&a.getClassGroup().getId().equals(s.getClassGroup().getId()));}
 private void requireCare(User u,Student s){if(!canCare(u,s,assignments.findByTeacherId(u.getId()),ownGrades(u)))throw AppException.forbidden("담당 학생의 돌봄 기록만 확인할 수 있습니다.");}
 public boolean studentAccess(Long id,User actor){var u=access.current(actor);return canCare(u,student(id),assignments.findByTeacherId(u.getId()),ownGrades(u));}

 public Overview overview(String requested,LocalDate requestedDate,User actor){
  var u=requireOverview(actor);String g=checkGrade(requested);LocalDate d=date(requestedDate);
  var assigned=assignments.findAllWithTeacherAndClass();
  var groups=classes.findAll().stream().filter(c->g.equals(grade(c.getAgeGroup()))).sorted(Comparator.comparing(ClassGroup::getName)).toList();
  var saved=reports.findByDateWithDetails(d).stream().collect(Collectors.toMap(r->r.getClassGroup().getId(),r->r,(a,b)->a));
  var classRows=new ArrayList<ClassCheck>();
  for(var group:groups){
   var source=newFamily.reconcile(saved.containsKey(group.getId())?sources.source(saved.get(group.getId())):sources.live(group,d),d);
   var rows=source.students();String status=!source.submitted()?"MISSING":source.changed()?"CHANGED":"SUBMITTED";
   classRows.add(new ClassCheck(group.getId(),group.getName(),source.teacherName(),status,source.submittedAt(),rows.size(),(int)rows.stream().filter(s->"PRESENT".equals(s.status())).count(),(int)rows.stream().filter(s->"ABSENT".equals(s.status())).count(),(int)rows.stream().filter(s->"LATE".equals(s.status())).count(),(int)rows.stream().filter(s->"UNKNOWN".equals(s.status())).count()));
  }
  // The meeting screen uses Monday–Sunday; the report uses the preceding Sunday.
  LocalDate saturday=d.plusDays(6);
  var vote=meetings.findByMeetingDate(saturday).stream().collect(Collectors.toMap(a->a.getTeacher().getId(),a->a));
  var worshipChecks=worship.findByWorshipDate(d).stream().collect(Collectors.toMap(a->a.getTeacher().getId(),a->a));
  var minute=minutes.findAllByIsActiveTrueOrderByMeetingDateDesc().stream().filter(m->!m.getMeetingDate().isBefore(saturday.minusDays(6))&&!m.getMeetingDate().isAfter(saturday)).findFirst().orElse(null);
  Set<Long> confirmed=minute==null?Set.of():confirms.findAllByMinutes(minute).stream().map(c->c.getUser().getId()).collect(Collectors.toSet());
  var teacherRows=users.findAllActiveWithClasses().stream().filter(t->!t.isSuspended()&&t.participatesInTeacherActivities()).filter(t->g.equals(grade(t.getGrade()))||assigned.stream().anyMatch(a->a.getTeacher().getId().equals(t.getId())&&g.equals(grade(a.getClassGroup().getAgeGroup())))).sorted(Comparator.comparing(User::getName)).map(t->{
   var v=vote.get(t.getId());var w=worshipChecks.get(t.getId());String status=v==null?"UNSUBMITTED":v.getStatus();
   String context=assigned.stream().filter(a->a.getTeacher().getId().equals(t.getId())&&g.equals(grade(a.getClassGroup().getAgeGroup()))).map(a->a.getClassGroup().getName()+" · "+(a.isPrimary()?"담임":"부담임")).collect(Collectors.joining(" / "));
   return new TeacherCheck(t.getId(),t.getName(),context,w==null?"UNKNOWN":w.getStatus(),w==null?null:w.getUpdatedAt(),status,v==null?"":v.getReason(),v==null?null:v.getUpdatedAt(),"ATTEND".equals(status)?"EXEMPT":minute==null?"NO_MINUTE":confirmed.contains(t.getId())?"CONFIRMED":"UNCONFIRMED");
  }).toList();
  var pupils=students.findAllActiveWithClassGroup().stream().filter(s->s.belongsToClassOn(today())&&g.equals(studentGrade(s))).toList();
  var ids=pupils.stream().map(Student::getId).toList();var history=ids.isEmpty()?List.<Attendance>of():attendance.findForCare(ids,d.minusWeeks(3),d);
  var ownedGrades=ownGrades(u);var allowed=pupils.stream().filter(s->canCare(u,s,assigned,ownedGrades)).map(Student::getId).toList();
  var notes=allowed.isEmpty()?List.<StudentCareRecord>of():records.forStudents(allowed);
  var pupilRows=pupils.stream().map(s->pupil(s,d,history,notes,allowed.contains(s.getId()))).toList();
  var choices=events.findByAttendanceRequiredTrueOrderByEventDateDesc().stream().map(this::eventChoice).toList();
  return new Overview(g,d,saturday,classRows,teacherRows,pupilRows,choices);
 }
 private EventChoice eventChoice(Event e){return new EventChoice(e.getId(),e.getTitle(),e.getEventDate(),e.getEndDate(),e.getAttendanceTarget()==null?"STUDENT_ONLY":e.getAttendanceTarget().name());}
 public EventCheck event(Long id,String requested,User actor){
  requireOverview(actor);String g=checkGrade(requested);var e=events.findById(id).orElseThrow(()->AppException.notFound("행사를 찾을 수 없습니다."));if(!e.isAttendanceRequired())throw AppException.badRequest("출석 확인 대상 행사가 아닙니다.");
  String target=eventChoice(e).target();
  var teacherRows=target.equals("STUDENT_ONLY")?List.<EventPerson>of():eventRoster.teacherSummary(id).stream().filter(t->g.equals(grade(t.grade()))).map(t->new EventPerson(t.teacherId(),t.teacherName(),t.grade(),Objects.toString(t.status(),"UNKNOWN"),t.absenceReason(),t.partialFromDate(),t.partialNote())).toList();
  var studentRows=target.equals("TEACHER_ONLY")?List.<EventPerson>of():eventRoster.studentRecords(id).stream().filter(s->g.equals(grade(s.grade()))).map(s->new EventPerson(s.studentId(),s.studentName(),s.classGroupName(),Objects.toString(s.status(),"UNKNOWN"),s.absenceReason(),s.partialFromDate(),s.partialNote())).toList();
  return new EventCheck(eventChoice(e),teacherRows,studentRows);
 }
 private Pupil pupil(Student s,LocalDate d,List<Attendance> all,List<StudentCareRecord> allNotes,boolean allowed){
  var byDate=all.stream().filter(a->a.getStudent().getId().equals(s.getId())).collect(Collectors.toMap(Attendance::getAttendanceDate,a->a));
  var history=new ArrayList<History>();for(int i=3;i>=0;i--){var day=d.minusWeeks(i);var a=byDate.get(day);history.add(new History(day,a!=null?a.getStatus().name():!s.belongsToClassOn(day)?"NOT_ASSIGNED":"UNKNOWN"));}
  var notes=allowed?allNotes.stream().filter(r->r.getStudent().getId().equals(s.getId())).toList():List.<StudentCareRecord>of();
  // Prayer notes are a single collection; legacy closed flags must not hide existing content.
  return new Pupil(s.getId(),s.getName(),studentGrade(s),s.getClassGroup().getId(),s.getClassGroup().getName(),s.getSchool(),allowed,history,(int)notes.stream().filter(n->n.getKind().equals("PRAYER")).count());
 }
 public Detail detail(Long id,LocalDate requestedDate,User actor){
  var u=access.current(actor);var s=student(id);requireCare(u,s);LocalDate d=date(requestedDate);
  var notes=records.forStudents(List.of(id));var history=attendance.findForCare(List.of(id),d.minusWeeks(3),d);
  var teachers=assignments.findByClassGroupId(s.getClassGroup().getId()).stream().filter(a->a.getTeacher().isActive()&&!a.getTeacher().isSuspended()).map(a->new Person(a.getTeacher().getId(),a.getTeacher().getName(),a.isPrimary()?"담임":"부담임")).toList();
  return new Detail(pupil(s,d,history,notes,true),teachers,notes.stream().map(r->note(r,u)).toList(),changes.forStudent(id).stream().map(c->new Change(c.getId(),c.getRecord().getId(),name(c.getActor()),c.getAction(),c.getOccurredAt())).toList());
 }
 private CareNote note(StudentCareRecord r,User u){return new CareNote(r.getId(),r.getRevision(),r.getKind(),r.getContent(),r.isFollowUp(),r.getFollowedAt(),r.isClosed(),name(r.getAuthor()),r.getAuthor()==null?null:r.getAuthor().getId(),r.getCreatedAt(),r.getUpdatedAt(),access.all(u)||r.getAuthor()!=null&&r.getAuthor().getId().equals(u.getId()));}
 private void valid(NoteInput in){if(in==null||in.kind()==null||!KINDS.contains(in.kind())||WeeklyReportSourceService.text(in.content(),4000).isBlank())throw AppException.badRequest("기록 종류와 내용을 확인해주세요.");}
 private void revision(StudentCareRecord r,Long value){if(value==null||value!=r.getRevision())throw AppException.conflict("다른 담당자가 수정했습니다. 최신 기록을 확인해주세요.");}
 private void audit(StudentCareRecord r,User u,String action){var c=new StudentCareChange();c.setRecord(r);c.setActor(u);c.setAction(action);c.setOccurredAt(now());changes.save(c);}
 @Transactional public CareNote create(Long id,NoteInput in,User actor){
  var u=access.current(actor);var s=student(id);requireCare(u,s);valid(in);
  var r=new StudentCareRecord();r.setStudent(s);r.setAuthor(u);r.setKind(in.kind());r.setContent(in.content().trim());r.setCreatedAt(now());r.setUpdatedAt(r.getCreatedAt());
  records.saveAndFlush(r);audit(r,u,"CREATED");return note(r,u);
 }
 @Transactional public CareNote update(Long id,Long recordId,NoteInput in,User actor){
  var u=access.current(actor);var s=student(id);requireCare(u,s);valid(in);var r=locked(id,recordId);revision(r,in.revision());
  if(!note(r,u).canEdit())throw AppException.forbidden("내용은 작성자·목사·관리자만 수정할 수 있습니다.");
  // Retired status metadata is preserved; editing a note changes only its content and kind.
  r.setKind(in.kind());r.setContent(in.content().trim());r.setRevision(r.getRevision()+1);r.setUpdatedAt(now());audit(r,u,"EDITED");return note(r,u);
 }
 private StudentCareRecord locked(Long studentId,Long recordId){var r=records.lockById(recordId).orElseThrow(()->AppException.notFound("기록을 찾을 수 없습니다."));if(!r.getStudent().getId().equals(studentId))throw AppException.notFound("기록을 찾을 수 없습니다.");return r;}
}
