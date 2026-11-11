package com.newaveflow;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import com.newaveflow.service.GradeCareService.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.security.JwtTokenProvider;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
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
class GradeCareHttpTest {
 @Autowired GradeCareService service; @Autowired OfficerOrganizationService offices; @Autowired UserRepository users;
 @Autowired StudentRepository students; @Autowired ClassGroupRepository classes; @Autowired TeacherClassRepository assignments;
 @Autowired AttendanceRepository attendance; @Autowired DailyReportRepository reports; @Autowired StudentMemoRepository privateMemos;
 @Autowired MeetingAttendanceRepository meetings; @Autowired MeetingMinuteRepository minutes; @Autowired MeetingMinuteConfirmRepository confirms;
 @Autowired TeacherWorshipAttendanceRepository worship; @Autowired EventRepository events; @Autowired EventRosterService roster;
 @Autowired EventStudentAttendanceRepository eventAttendance; @Autowired CommunityAgreementRepository agreements;
 @Autowired StudentCareRecordRepository records; @Autowired StudentCareChangeRepository changes;
 @Autowired MockMvc http; @Autowired JwtTokenProvider tokens; @Autowired jakarta.persistence.EntityManager em;
 User admin,pastor,chair,teacher,assistant,other,officer; ClassGroup c1,c2,c3; Student a,b,unknown;
 LocalDate today=LocalDate.now(OfficerAccessService.ZONE),date=today.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
 User user(String name,User.Role role,String grade){var u=users.saveAndFlush(User.builder().name(name).email(UUID.randomUUID()+"@example.invalid").role(role).grade(grade).build());agreements.saveAndFlush(new CommunityAgreement(u.getId(),CommunitySafetyService.POLICY_VERSION));return u;}
 String auth(User u){u=users.findById(u.getId()).orElseThrow();return "Bearer "+tokens.createAccessToken(u.getId(),u.getEmail(),u.getRole().name(),u.getAuthVersion());}
 ClassGroup group(String name,String grade){return classes.saveAndFlush(ClassGroup.builder().name(name).ageGroup(grade).build());}
 Student student(String name,ClassGroup c){return students.saveAndFlush(Student.builder().name(name).grade(c.getAgeGroup()).classGroup(c).build());}
 void appoint(User person){var org=offices.get(null,admin);offices.assign(org.activeYear(),OfficerPosition.GRADE_M1,new OfficerOrganizationService.Assignment(org.revision(),person==null?null:person.getId()),admin);}
 NoteInput input(String text){return new NoteInput(null,"PRAYER",text,true);}
 @BeforeEach void setup(){
  admin=user("가상관리",User.Role.ADMIN,null);pastor=user("가상목사",User.Role.PASTOR,null);chair=user("가상학년부장",User.Role.EXECUTIVE,"중1");teacher=user("가상담임",User.Role.TEACHER,"중1");assistant=user("가상부담임",User.Role.TEACHER,"중1");other=user("가상다른교사",User.Role.TEACHER,"중2");officer=user("가상다른임원",User.Role.EXECUTIVE,"중1");
  c1=group("중1 1반","중1");c2=group("중1 2반","중1");c3=group("중2 1반","중2");
  assignments.saveAndFlush(TeacherClass.builder().teacher(teacher).classGroup(c1).isPrimary(true).build());assignments.saveAndFlush(TeacherClass.builder().teacher(assistant).classGroup(c1).build());assignments.saveAndFlush(TeacherClass.builder().teacher(other).classGroup(c3).isPrimary(true).build());
  a=student("가상가람",c1);unknown=student("가상미기록",c2);b=student("가상다른학년",c3);appoint(chair);
 }
 @Test void privateRecordsAreRestrictedToCurrentCareTeamAcrossEveryEndpoint()throws Exception{
  var note=service.create(a.getId(),input("가상 비공개 기도"),teacher);
  for(var u:List.of(admin,pastor,chair,teacher,assistant))assertEquals(1,service.detail(a.getId(),date,u).records().size());
  for(var u:List.of(officer,other)){
   http.perform(get("/api/grade-care/students/"+a.getId()).header("Authorization",auth(u))).andExpect(status().isForbidden());
   http.perform(post("/api/grade-care/students/"+a.getId()+"/records").header("Authorization",auth(u)).contentType("application/json").content("{\"kind\":\"UPDATE\",\"content\":\"blocked\",\"followUp\":false}")).andExpect(status().isForbidden());
   http.perform(put("/api/grade-care/students/"+a.getId()+"/records/"+note.id()).header("Authorization",auth(u)).contentType("application/json").content("{\"revision\":0,\"kind\":\"UPDATE\",\"content\":\"blocked\"}")).andExpect(status().isForbidden());
  }
  http.perform(get("/api/grade-care/students/"+a.getId()).header("Authorization",auth(chair))).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"));
  http.perform(get("/api/grade-care").param("grade","중1").header("Authorization",auth(teacher))).andExpect(status().isForbidden());
  http.perform(get("/api/grade-care/students/"+a.getId())).andExpect(status().isUnauthorized());
  assertFalse(service.studentAccess(a.getId(),officer));
 }
 @Test void commonOverviewDoesNotExposeNotesOrPrivateMemoAndReadHasNoSideEffects()throws Exception{
  service.create(a.getId(),input("SHARED_SENTINEL"),teacher);
  privateMemos.saveAndFlush(StudentMemo.builder().student(students.findById(a.getId()).orElseThrow()).teacher(users.findById(teacher.getId()).orElseThrow()).prayerRequest("PRIVATE_SENTINEL").sketch("PRIVATE_SKETCH").build());
  long before=records.count(),auditBefore=changes.count();
  var summary=service.overview("중1",date,officer);assertEquals(2,summary.students().size());assertTrue(summary.students().stream().noneMatch(Pupil::canCare));assertTrue(summary.students().stream().allMatch(s->s.prayerCount()==0));
  String result=http.perform(get("/api/grade-care").param("grade","중1").param("date",date.toString()).header("Authorization",auth(officer))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
  assertFalse(result.contains("SENTINEL"));assertFalse(result.contains("needsFollowUp"));assertFalse(result.contains("phone"));assertFalse(result.contains("email"));
  result=http.perform(get("/api/grade-care/students/"+a.getId()).header("Authorization",auth(chair))).andReturn().getResponse().getContentAsString();assertFalse(result.contains("PRIVATE_SENTINEL"));
  assertEquals(before,records.count());assertEquals(auditBefore,changes.count());
 }
 @Test void officeClassAndStudentChangesImmediatelyRevokeAccess(){
  service.create(a.getId(),input("가상 근황"),teacher);appoint(null);assertThrows(AppException.class,()->service.detail(a.getId(),date,chair));
  assignments.deleteByClassGroup_IdAndTeacher_Id(c1.getId(),assistant.getId());em.flush();assertThrows(AppException.class,()->service.detail(a.getId(),date,assistant));
  students.findById(a.getId()).orElseThrow().assignClass(classes.findById(c3.getId()).orElseThrow());em.flush();assertThrows(AppException.class,()->service.detail(a.getId(),date,teacher));assertEquals(1,service.detail(a.getId(),date,other).records().size());
  users.findById(other.getId()).orElseThrow().suspend();em.flush();assertThrows(AppException.class,()->service.detail(a.getId(),date,other));
 }
 @Test void authorsEditWithConflictProtectionAndRetiredMetadataIsPreserved()throws Exception{
  http.perform(post("/api/grade-care/students/"+a.getId()+"/records").header("Authorization",auth(teacher)).contentType("application/json").content("{\"kind\":\"PRAYER\",\"content\":\"첫 기록\"}")).andExpect(status().isOk());
  var note=service.detail(a.getId(),date,teacher).records().get(0);assertFalse(note.followUp());assertNull(note.followedAt());
  var legacy=records.findById(note.id()).orElseThrow();var oldTime=date.minusDays(1).atTime(12,0);legacy.setFollowUp(true);legacy.setFollowedAt(oldTime);legacy.setClosed(true);records.saveAndFlush(legacy);
  var change=new StudentCareChange();change.setRecord(legacy);change.setActor(users.findById(assistant.getId()).orElseThrow());change.setAction("FOLLOWED");change.setOccurredAt(oldTime);changes.saveAndFlush(change);
  assertFalse(service.detail(a.getId(),date,chair).records().get(0).canEdit());
  assertThrows(AppException.class,()->service.update(a.getId(),note.id(),new NoteInput(0L,"PRAYER","다른 사람 내용 수정",null),chair));
  var edited=service.update(a.getId(),note.id(),new NoteInput(0L,"PRAYER","새 기록",null),teacher);assertEquals(1,edited.revision());
  assertTrue(edited.followUp());assertEquals(oldTime,edited.followedAt());assertTrue(edited.closed());
  http.perform(put("/api/grade-care/students/"+a.getId()+"/records/"+note.id()).header("Authorization",auth(teacher)).contentType("application/json").content("{\"revision\":0,\"kind\":\"PRAYER\",\"content\":\"stale\"}")).andExpect(status().isConflict());
  var preserved=service.overview("중1",date,chair).students().stream().filter(s->s.id().equals(a.getId())).findFirst().orElseThrow();assertEquals(1,preserved.prayerCount());
  var detail=service.detail(a.getId(),date,teacher);assertEquals(3,detail.changes().size());assertEquals("새 기록",detail.records().get(0).content());
  assertThrows(AppException.class,()->service.update(b.getId(),note.id(),new NoteInput(1L,"UPDATE","wrong student",null),admin));
 }
 @Test void missingAttendanceIsNotAbsenceAndClassSubmissionUsesExistingSources(){
  attendance.saveAndFlush(Attendance.builder().student(students.findById(a.getId()).orElseThrow()).classGroup(classes.findById(c1.getId()).orElseThrow()).attendanceDate(date).status(Attendance.Status.ABSENT).build());
  attendance.saveAndFlush(Attendance.builder().student(students.findById(a.getId()).orElseThrow()).classGroup(classes.findById(c1.getId()).orElseThrow()).attendanceDate(date.minusWeeks(1)).status(Attendance.Status.ABSENT).build());
  var r=reports.saveAndFlush(DailyReport.builder().classGroup(classes.findById(c1.getId()).orElseThrow()).teacher(users.findById(teacher.getId()).orElseThrow()).reportDate(date).status(DailyReport.Status.SUBMITTED).build());
  var result=service.overview("중1",date,chair);assertEquals("SUBMITTED",result.classes().stream().filter(c->c.id().equals(c1.getId())).findFirst().orElseThrow().status());
  var un=result.students().stream().filter(s->s.id().equals(unknown.getId())).findFirst().orElseThrow();assertEquals("UNKNOWN",un.history().get(3).status());
  assertEquals("ABSENT",result.students().stream().filter(s->s.id().equals(a.getId())).findFirst().orElseThrow().history().get(3).status());
  assertTrue(service.detail(a.getId(),date,chair).records().isEmpty());
  var contact=service.create(a.getId(),new NoteInput(null,"CONTACT","다음 주에 만나기로 했어요.",true),chair);assertFalse(contact.followUp());assertNull(contact.followedAt());
  r.markDraftChanged();em.flush();assertEquals("CHANGED",service.overview("중1",date,chair).classes().stream().filter(c->c.id().equals(c1.getId())).findFirst().orElseThrow().status());
 }
 @Test void teacherWorshipMeetingAndMinutesComeFromExistingRecords(){
  var t=users.findById(teacher.getId()).orElseThrow();var w=new TeacherWorshipAttendance();w.setTeacher(t);w.setWorshipDate(date);w.setGender("F");w.setStatus("PRESENT");worship.saveAndFlush(w);
  meetings.saveAndFlush(MeetingAttendance.builder().teacher(t).meetingDate(date.plusDays(6)).status("ABSENT").reason("가상 일정").build());
  var m=minutes.saveAndFlush(MeetingMinute.builder().title("가상 회의").content("가상 내용").meetingDate(date.plusDays(6)).build());
  var row=service.overview("중1",date,chair).teachers().stream().filter(x->x.id().equals(teacher.getId())).findFirst().orElseThrow();assertEquals("PRESENT",row.worship());assertEquals("ABSENT",row.meeting());assertEquals("UNCONFIRMED",row.minute());
  confirms.saveAndFlush(MeetingMinuteConfirm.builder().minutes(m).user(t).build());assertEquals("CONFIRMED",service.overview("중1",date,chair).teachers().stream().filter(x->x.id().equals(teacher.getId())).findFirst().orElseThrow().minute());
 }
 @Test void eventResponsesKeepCapturedGradeAndTarget(){
  var e=events.saveAndFlush(Event.builder().title("가상 행사").eventDate(date).eventType(Event.EventType.SPECIAL).attendanceRequired(true).attendanceTarget(Event.AttendanceTarget.STUDENT_ONLY).build());roster.capture(e);em.flush();
  students.findById(a.getId()).orElseThrow().updateGrade("고1");students.findById(a.getId()).orElseThrow().assignClass(classes.findById(c3.getId()).orElseThrow());em.flush();
  var result=service.event(e.getId(),"중1",chair);assertEquals(2,result.students().size());assertTrue(result.teachers().isEmpty());assertEquals("UNKNOWN",result.students().get(0).status());
  assertTrue(service.event(e.getId(),"고1",chair).students().isEmpty());
 }
 @Test void invalidFutureInactiveAndUnknownInputsAreRejected()throws Exception{
  assertThrows(AppException.class,()->service.overview("중12",date,chair));assertThrows(AppException.class,()->service.overview("중1",date.plusWeeks(1),chair));
  assertThrows(AppException.class,()->service.create(a.getId(),new NoteInput(null,null,"x",false),teacher));assertThrows(AppException.class,()->service.create(a.getId(),new NoteInput(null,"UPDATE"," ",false),teacher));assertThrows(AppException.class,()->service.create(a.getId(),new NoteInput(null,"UPDATE","x".repeat(4001),false),teacher));
  var s=students.findById(a.getId()).orElseThrow();s.admitToClass(s.getClassGroup(),today.plusDays(1));em.flush();assertThrows(AppException.class,()->service.detail(a.getId(),date,teacher));assertTrue(service.overview("중1",date,chair).students().stream().noneMatch(p->p.id().equals(a.getId())));
 }
}
