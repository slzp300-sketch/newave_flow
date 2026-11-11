package com.newaveflow;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import com.newaveflow.service.WorshipService.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.exception.AppException;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class WorshipHttpTest {
 @Autowired WorshipService service; @Autowired OfficerOrganizationService offices; @Autowired UserRepository users;
 @Autowired StudentRepository students; @Autowired CommunityAgreementRepository agreements; @Autowired JwtTokenProvider tokens;
 @Autowired MockMvc http; @Autowired WorshipWeekRepository weeks; @Autowired jakarta.persistence.EntityManager em;
 User admin,chair,member,other,officer; Student student1,student2; LocalDate date=LocalDate.of(2026,11,8);
 User user(String name,User.Role role){var u=users.saveAndFlush(User.builder().name(name).email(UUID.randomUUID()+"@example.invalid").role(role).build());agreements.saveAndFlush(new CommunityAgreement(u.getId(),CommunitySafetyService.POLICY_VERSION));return u;}
 String auth(User u){u=users.findById(u.getId()).orElseThrow();return "Bearer "+tokens.createAccessToken(u.getId(),u.getEmail(),u.getRole().name(),u.getAuthVersion());}
 @BeforeEach void setup(){
  admin=user("가상관리",User.Role.ADMIN);chair=user("가상팀장",User.Role.EXECUTIVE);member=user("가상팀원",User.Role.TEACHER);other=user("가상다른교사",User.Role.TEACHER);officer=user("가상임원",User.Role.EXECUTIVE);
  student1=students.saveAndFlush(Student.builder().name("가상학생가람").grade("중1").build());student2=students.saveAndFlush(Student.builder().name("가상학생나래").grade("고1").build());
  var org=offices.get(null,admin);offices.assign(org.activeYear(),OfficerPosition.WORSHIP,new OfficerOrganizationService.Assignment(org.revision(),chair.getId()),admin);
  service.members(date,new MemberInput(0L,List.of(member.getId())),chair);
 }
 State fill(){return service.committee(date,new CommitteeInput(0L,"중1",other.getId(),student1.getId(),List.of(student1.getId(),student2.getId()),"예배 10분 전 준비해주세요."),chair);}
 TaskView task(State s,String key){return s.tasks().stream().filter(t->t.key().equals(key)).findFirst().orElseThrow();}
 @Test void readsAreSideEffectFreeAndPermissionsAreEnforcedOverHttp()throws Exception{
  long before=weeks.count();assertEquals(0,service.state(date,member).revision());assertEquals(before,weeks.count());
  assertTrue(offices.capability(member).canWorship());assertTrue(offices.capability(officer).canWorship());assertFalse(offices.capability(other).canWorship());
  http.perform(get("/api/worship").param("date",date.toString())).andExpect(status().isUnauthorized());
  http.perform(get("/api/worship").param("date",date.toString()).header("Authorization",auth(other))).andExpect(status().isForbidden());
  http.perform(get("/api/worship").param("date",date.toString()).header("Authorization",auth(officer))).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andExpect(jsonPath("$.canWork").value(false)).andExpect(jsonPath("$.candidates").isEmpty()).andExpect(jsonPath("$.students").isEmpty());
  http.perform(put("/api/worship/"+date+"/tasks/banner/check").contentType("application/json").content("{\"revision\":0,\"checked\":true}").header("Authorization",auth(officer))).andExpect(status().isForbidden());
  http.perform(put("/api/worship/team").contentType("application/json").content("{\"revision\":1,\"userIds\":[]}").header("Authorization",auth(member))).andExpect(status().isForbidden());
 }
 @Test void committeePersistsOrderedNamesAndNoPrivateProfiles()throws Exception{
  var s=fill();assertEquals(1,s.revision());assertNull(s.announced());
  em.flush();em.clear();
  var body=http.perform(get("/api/worship").param("date",date.toString()).header("Authorization",auth(member))).andExpect(status().isOk()).andExpect(jsonPath("$.offerings[0].name").value("가상학생가람")).andReturn().getResponse().getContentAsString();
  assertFalse(body.contains("@example.invalid"));assertFalse(body.contains("phone"));assertFalse(body.contains("birthDate"));
  var reversed=service.committee(date,new CommitteeInput(1L,"고1",other.getId(),student2.getId(),List.of(student2.getId(),student1.getId()),""),chair);
  assertEquals(student2.getId(),reversed.offerings().get(0).id());em.flush();
 }
 @Test void preparationReviewAndUndoAreSeparateAndNewWeeksStartBlank(){
  assertThrows(AppException.class,()->service.check(date,"banner",true,new CheckInput(0L,true),chair));
  var s=service.check(date,"banner",false,new CheckInput(0L,true),member);assertNotNull(task(s,"banner").completed());assertNull(task(s,"banner").reviewed());
  assertThrows(AppException.class,()->service.check(date,"banner",true,new CheckInput(1L,true),member));
  s=service.check(date,"banner",true,new CheckInput(1L,true),chair);assertNotNull(task(s,"banner").reviewed());
  s=service.check(date,"banner",false,new CheckInput(2L,false),member);assertNull(task(s,"banner").completed());assertNull(task(s,"banner").reviewed());
  service.check(date,"banner",false,new CheckInput(3L,true),member);
  assertTrue(service.state(date.plusWeeks(1),member).tasks().stream().allMatch(t->t.completed()==null));
  assertNotNull(task(service.state(date,member),"banner").completed());
  assertThrows(AppException.class,()->service.check(date,"video",false,new CheckInput(0L,true),member));
 }
 @Test void assignedTaskRequiresAssigneeAndReassignmentClearsCompletion(){
  service.members(date,new MemberInput(1L,List.of(member.getId(),other.getId())),chair);
  service.assign(date,"banner",new AssignInput(0L,member.getId()),chair);
  assertThrows(AppException.class,()->service.check(date,"banner",false,new CheckInput(1L,true),other));
  service.check(date,"banner",false,new CheckInput(1L,true),member);service.check(date,"banner",true,new CheckInput(2L,true),chair);
  var s=service.assign(date,"banner",new AssignInput(3L,other.getId()),chair);assertNull(task(s,"banner").completed());assertNull(task(s,"banner").reviewed());
  service.members(date,new MemberInput(2L,List.of(member.getId())),chair);
  assertThrows(AppException.class,()->service.check(date,"banner",false,new CheckInput(4L,true),other));
  assertFalse(task(service.state(date,chair),"banner").assigneeAvailable());
 }
 @Test void rosterChangesResetAnnouncementAndRelevantGuidanceOnly(){
  fill();service.announce(date,new CheckInput(1L,true),chair);service.check(date,"students",false,new CheckInput(0L,true),chair);service.check(date,"banner",false,new CheckInput(0L,true),member);
  var s=service.committee(date,new CommitteeInput(2L,"중1",other.getId(),student1.getId(),List.of(student2.getId()),""),chair);
  assertNull(s.announced());assertNull(task(s,"students").completed());assertNotNull(task(s,"banner").completed());
 }
 @Test void staleVersionsInvalidDatesAndInactivePeopleAreRejected()throws Exception{
  fill();
  http.perform(put("/api/worship/"+date+"/announcement").header("Authorization",auth(chair)).contentType("application/json").content("{\"revision\":0,\"checked\":true}")).andExpect(status().isConflict());
  assertThrows(AppException.class,()->service.state(date.plusDays(1),chair));
  assertThrows(AppException.class,()->service.committee(date,new CommitteeInput(1L,"대학교",null,null,List.of(),""),chair));
  assertThrows(AppException.class,()->service.committee(date,new CommitteeInput(1L,"중1",null,null,List.of(student1.getId(),student1.getId()),""),chair));
  students.findById(student2.getId()).orElseThrow().deactivate();em.flush();
  assertThrows(AppException.class,()->service.committee(date,new CommitteeInput(1L,"중1",null,null,List.of(student2.getId()),""),chair));
  assertThrows(AppException.class,()->service.announce(date.plusWeeks(1),new CheckInput(0L,true),chair));
 }
 @Test void officeRevocationIsEffectiveImmediately(){
  var org=offices.get(null,admin);offices.assign(org.activeYear(),OfficerPosition.WORSHIP,new OfficerOrganizationService.Assignment(org.revision(),null),admin);
  assertFalse(service.state(date,chair).canLead());
  assertThrows(AppException.class,()->service.check(date,"video",false,new CheckInput(0L,true),chair));
 }
}
