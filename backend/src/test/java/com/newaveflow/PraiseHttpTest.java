package com.newaveflow;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import com.newaveflow.service.PraiseService.*;
import com.newaveflow.security.JwtTokenProvider;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import java.io.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class PraiseHttpTest {
 @Autowired PraiseService service; @Autowired UserRepository users; @Autowired StudentRepository students;
 @Autowired OfficerOrganizationService offices; @Autowired CommunityAgreementRepository agreements;
 @Autowired JwtTokenProvider tokens; @Autowired MockMvc http; @Autowired PraiseTermRepository terms;
 @MockBean Clock clock;
 User admin,chair,teacher,outsider; Student student; State state; Long teacherMember,studentMember;
 User user(String name,User.Role role){var u=users.saveAndFlush(User.builder().name(name).email(UUID.randomUUID()+"@example.invalid").role(role).build());agreements.saveAndFlush(new CommunityAgreement(u.getId(),CommunitySafetyService.POLICY_VERSION));return u;}
 String auth(User u){u=users.findById(u.getId()).orElseThrow();return "Bearer "+tokens.createAccessToken(u.getId(),u.getEmail(),u.getRole().name(),u.getAuthVersion());}
 long id(){return state.term().id();} long rev(){return state.term().revision();}
 @BeforeEach void setup(){
  when(clock.instant()).thenReturn(Instant.parse("2026-11-03T00:00:00Z"));when(clock.getZone()).thenReturn(ZoneId.of("Asia/Seoul"));
  admin=user("가상관리",User.Role.ADMIN);chair=user("가상찬양",User.Role.EXECUTIVE);teacher=user("가상교사",User.Role.TEACHER);outsider=user("가상비팀원",User.Role.TEACHER);
  var org=offices.get(null,admin);offices.assign(org.activeYear(),OfficerPosition.PRAISE,new OfficerOrganizationService.Assignment(org.revision(),chair.getId()),admin);
  student=students.saveAndFlush(Student.builder().name("가상학생").grade("중1").build());
  state=service.create(new TermInput(2026,2),chair);
  state=service.member(id(),new MemberInput(rev(),null,teacher.getId(),null,List.of("인도자","메인"),true),chair);teacherMember=state.members().get(0).id();
  state=service.member(id(),new MemberInput(rev(),null,null,student.getId(),List.of("인도자","싱어"),true),chair);studentMember=state.members().get(1).id();
  state=service.generate(id(),new MonthInput(rev(),"2026-12"),chair);
 }
 void edit(Long week,Long leader){var w=state.weeks().stream().filter(v->v.id().equals(week)).findFirst().orElseThrow();state=service.week(id(),week,new WeekInput(rev(),w.practiceDate(),w.startTime(),w.endTime(),Map.of("인도자",List.of(leader)),false),chair);}
 void publish(){for(var w:List.copyOf(state.weeks()))edit(w.id(),teacherMember);state=service.publish(id(),new MonthInput(rev(),"2026-12"),chair);}
 MockMultipartFile pdf()throws Exception{try(var d=new org.apache.pdfbox.pdmodel.PDDocument();var out=new ByteArrayOutputStream()){d.addPage(new org.apache.pdfbox.pdmodel.PDPage());d.save(out);return new MockMultipartFile("file","score.pdf","application/pdf",out.toByteArray());}}
 @Test void membershipAndOfficerAuthorityAreEnforcedAtServer()throws Exception{
  http.perform(get("/api/praise").param("term",String.valueOf(id())).header("Authorization",auth(outsider))).andExpect(status().isForbidden());
  http.perform(get("/api/praise").param("term",String.valueOf(id())).header("Authorization",auth(teacher))).andExpect(status().isOk()).andExpect(jsonPath("$.canManage").value(false)).andExpect(jsonPath("$.candidates").isEmpty());
  assertThrows(com.newaveflow.exception.AppException.class,()->service.generate(id(),new MonthInput(rev(),"2026-11"),teacher));
  var org=offices.get(null,admin);offices.assign(org.activeYear(),OfficerPosition.PRAISE,new OfficerOrganizationService.Assignment(org.revision(),null),admin);
  assertThrows(com.newaveflow.exception.AppException.class,()->service.state(id(),chair));
 }
 @Test void draftsNeverReplacePublishedTeacherAssignmentsAndStaleWritesFail(){
  var w=state.weeks().get(0);edit(w.id(),teacherMember);assertTrue(service.state(id(),teacher).weeks().get(0).slots().isEmpty());
  publish();long previous=rev();edit(w.id(),studentMember);
  assertEquals(List.of(teacherMember),service.state(id(),teacher).weeks().get(0).slots().get("인도자"));
  assertThrows(com.newaveflow.exception.AppException.class,()->service.generate(id(),new MonthInput(previous,"2026-11"),chair));
  state=service.publish(id(),new MonthInput(rev(),"2026-12"),chair);assertEquals(List.of(studentMember),service.state(id(),teacher).weeks().get(0).slots().get("인도자"));
 }
 @Test void availabilityIsSelfOnlySaturdayOnlyAndTimeChangesNeedReconfirmation()throws Exception{
  var versions=new LinkedHashMap<String,Long>();state.weeks().forEach(w->versions.put(w.id().toString(),w.scheduleVersion()));
  state=service.respond(id(),new ResponseInput(rev(),"2026-12",List.of(LocalDate.of(2026,12,12)),versions),teacher);
  assertEquals(teacher.getId(),state.responses().get(0).userId());assertEquals(1,service.state(id(),chair).responses().size());
  long revision=rev();assertThrows(com.newaveflow.exception.AppException.class,()->service.respond(id(),new ResponseInput(revision,"2026-12",List.of(LocalDate.of(2026,12,13)),versions),teacher));
  var w=state.weeks().get(1);state=service.week(id(),w.id(),new WeekInput(rev(),w.practiceDate(),LocalTime.of(13,0),LocalTime.of(15,30),Map.of(),false),chair);
  long changedRevision=rev();assertThrows(com.newaveflow.exception.AppException.class,()->service.respond(id(),new ResponseInput(changedRevision,"2026-12",List.of(),versions),teacher));
  versions.put(w.id().toString(),1L);state=service.respond(id(),new ResponseInput(rev(),"2026-12",List.of(),versions),teacher);assertTrue(state.responses().get(0).dates().isEmpty());
  http.perform(put("/api/praise/terms/"+id()+"/availability").header("Authorization",auth(outsider)).contentType("application/json").content("{\"revision\":"+rev()+",\"month\":\"2026-12\",\"dates\":[],\"scheduleVersions\":{}} ")).andExpect(status().isForbidden());
 }
 @Test void unavailableAssignmentRequiresExplicitOverrideAndCannotUseOtherTermMember(){
  var versions=new LinkedHashMap<String,Long>();state.weeks().forEach(w->versions.put(w.id().toString(),w.scheduleVersion()));var w=state.weeks().get(0);
  state=service.respond(id(),new ResponseInput(rev(),"2026-12",List.of(w.practiceDate()),versions),teacher);
  assertThrows(com.newaveflow.exception.AppException.class,()->service.week(id(),w.id(),new WeekInput(rev(),w.practiceDate(),w.startTime(),w.endTime(),Map.of("인도자",List.of(teacherMember)),false),chair));
  state=service.week(id(),w.id(),new WeekInput(rev(),w.practiceDate(),w.startTime(),w.endTime(),Map.of("인도자",List.of(teacherMember)),true),chair);
  assertThrows(com.newaveflow.exception.AppException.class,()->service.week(id(),w.id(),new WeekInput(rev(),w.practiceDate(),w.startTime(),w.endTime(),Map.of("인도자",List.of(999999L)),true),chair));
 }
 @Test void pdfIsRealPrivateVersionedAndStudentLeaderRequiresChair()throws Exception{
  publish();var w=state.weeks().get(0);state=service.upload(id(),w.id(),rev(),pdf(),teacher);Long file=state.weeks().get(0).pdfs().get(0).id();
  http.perform(get("/api/praise/pdf/"+file).header("Authorization",auth(teacher))).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andExpect(content().contentTypeCompatibleWith("application/pdf"));
  http.perform(get("/api/praise/pdf/"+file).header("Authorization",auth(outsider))).andExpect(status().isForbidden());
  http.perform(get("/api/praise/pdf/"+file+"/pages/0").header("Authorization",auth(teacher))).andExpect(status().isOk()).andExpect(content().contentTypeCompatibleWith("image/png"));
  http.perform(get("/api/praise/pdf/"+file+"/pages/0").header("Authorization",auth(outsider))).andExpect(status().isForbidden());
  http.perform(get("/api/praise/pdf/"+file+"/pages/999").header("Authorization",auth(teacher))).andExpect(status().isBadRequest());
  assertThrows(com.newaveflow.exception.AppException.class,()->service.upload(id(),w.id(),rev(),new MockMultipartFile("file","fake.pdf","application/pdf","not pdf".getBytes()),teacher));
  edit(w.id(),studentMember);state=service.publish(id(),new MonthInput(rev(),"2026-12"),chair);
  assertThrows(com.newaveflow.exception.AppException.class,()->service.upload(id(),w.id(),rev(),pdf(),teacher));
  state=service.upload(id(),w.id(),rev(),pdf(),chair);assertEquals(2,state.weeks().get(0).pdfs().size());assertEquals(2,state.weeks().get(0).pdfs().get(0).version());
  state=service.member(id(),new MemberInput(rev(),teacherMember,null,null,List.of("인도자"),false),chair);
  http.perform(get("/api/praise/pdf/"+file).header("Authorization",auth(teacher))).andExpect(status().isForbidden());
 }
 @Test void prayerHostCanChangeOnlyOwnLinkAndDatesStayInTerm(){
  state=service.prayer(id(),new PrayerInput(rev(),LocalDate.of(2026,12,3),teacherMember,"https://zoom.us/j/123"),chair);
  state=service.prayer(id(),new PrayerInput(rev(),LocalDate.of(2026,12,3),teacherMember,"https://us02web.zoom.us/j/456"),teacher);
  assertThrows(com.newaveflow.exception.AppException.class,()->service.prayer(id(),new PrayerInput(rev(),LocalDate.of(2026,12,3),teacherMember,"https://zoom.us.evil.example/j/1"),teacher));
  assertThrows(com.newaveflow.exception.AppException.class,()->service.prayer(id(),new PrayerInput(rev(),LocalDate.of(2026,12,10),teacherMember,""),teacher));
  assertThrows(com.newaveflow.exception.AppException.class,()->service.generate(id(),new MonthInput(rev(),"2026-08"),chair));
  assertEquals(4,state.weeks().size());
 }
 @Test void bulkRosterRegistrationPreservesDistinctReferences(){
  var a=user("가상추가1",User.Role.TEACHER);var b=user("가상추가2",User.Role.TEACHER);long before=rev();
  state=service.members(id(),new BulkMembersInput(rev(),List.of(new MemberInput(null,null,a.getId(),null,List.of("싱어"),true),new MemberInput(null,null,b.getId(),null,List.of("싱어"),true))),chair);
  assertEquals(before+1,rev());assertEquals(4,state.members().size());assertTrue(service.canEnter(a));assertTrue(service.canEnter(b));
 }
 @Test void saturdayMonthKeepsSundayRehearsalAcrossTermBoundary(){
  state=service.create(new TermInput(2022,2),chair);state=service.generate(id(),new MonthInput(rev(),"2022-12"),chair);
  var w=state.weeks().stream().filter(v->v.worshipDate().equals(LocalDate.of(2023,1,1))).findFirst().orElseThrow();
  state=service.week(id(),w.id(),new WeekInput(rev(),w.worshipDate(),LocalTime.of(9,0),LocalTime.of(10,0),Map.of(),false),chair);
  assertEquals(LocalDate.of(2023,1,1),state.weeks().get(state.weeks().size()-1).practiceDate());
 }
}
