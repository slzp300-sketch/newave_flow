package com.newaveflow;

import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import com.newaveflow.security.JwtTokenProvider;
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
class TeamVisibilityHttpTest {
 @Autowired MockMvc http;
 @Autowired UserRepository users;
 @Autowired CommunityAgreementRepository agreements;
 @Autowired JwtTokenProvider tokens;
 @Autowired PraiseService praise;
 @Autowired IntercessionService intercession;
 @Autowired NewFamilyService family;
 @Autowired OfficerOrganizationService offices;
 User admin,executive,member,outsider;
 long term;

 User user(String name,User.Role role){var u=users.saveAndFlush(User.builder().name(name).email(UUID.randomUUID()+"@example.invalid").role(role).build());agreements.saveAndFlush(new CommunityAgreement(u.getId(),CommunitySafetyService.POLICY_VERSION));return u;}
 String auth(User u){u=users.findById(u.getId()).orElseThrow();return "Bearer "+tokens.createAccessToken(u.getId(),u.getEmail(),u.getRole().name(),u.getAuthVersion());}
 @BeforeEach void setup(){
  admin=user("가상관리자",User.Role.ADMIN);executive=user("가상일반임원",User.Role.EXECUTIVE);member=user("가상소속교사",User.Role.TEACHER);outsider=user("가상비소속교사",User.Role.TEACHER);
  member.updateNewFamilyTeam(true);users.flush();
  var state=praise.create(new PraiseService.TermInput(2026,2),admin);term=state.term().id();
  praise.member(term,new PraiseService.MemberInput(state.term().revision(),null,member.getId(),null,List.of("싱어"),true),admin);
  intercession.members(new IntercessionService.MemberInput(0L,List.of(member.getId())),admin);
 }
 @Test void executivesSeeEveryTeamButCannotModifyTeamsTheyDoNotManage() throws Exception {
  http.perform(get("/api/officers/me").header("Authorization",auth(executive))).andExpect(status().isOk()).andExpect(jsonPath("$.canPraise").value(true)).andExpect(jsonPath("$.canIntercession").value(true)).andExpect(jsonPath("$.canNewFamily").value(true)).andExpect(jsonPath("$.canReport").value(false));
  http.perform(get("/api/praise").param("term",String.valueOf(term)).header("Authorization",auth(executive))).andExpect(status().isOk()).andExpect(jsonPath("$.canManage").value(false)).andExpect(jsonPath("$.canViewAll").value(true)).andExpect(jsonPath("$.members.length()").value(1)).andExpect(jsonPath("$.candidates").isEmpty());
  http.perform(put("/api/praise/terms/{id}/members",term).header("Authorization",auth(executive)).contentType("application/json").content("{}")).andExpect(status().isForbidden());
  http.perform(put("/api/praise/terms/{id}/availability",term).header("Authorization",auth(executive)).contentType("application/json").content("{}")).andExpect(status().isForbidden());
  http.perform(get("/api/new-family/capability").header("Authorization",auth(executive))).andExpect(jsonPath("$.canView").value(true)).andExpect(jsonPath("$.canManage").value(false)).andExpect(jsonPath("$.canAssign").value(false)).andExpect(jsonPath("$.canManageTeam").value(false));
  http.perform(get("/api/new-family/people").header("Authorization",auth(executive))).andExpect(status().isOk());
  var sunday=LocalDate.now().with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
  http.perform(get("/api/new-family/weeks/{date}",sunday).header("Authorization",auth(executive))).andExpect(status().isOk());
  http.perform(get("/api/new-family/team").header("Authorization",auth(executive))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(member.getId()));
  http.perform(post("/api/new-family/people").header("Authorization",auth(executive)).contentType("application/json").content("{}")).andExpect(status().isForbidden());
  http.perform(put("/api/new-family/team/{id}",outsider.getId()).header("Authorization",auth(executive)).contentType("application/json").content("{\"member\":true}")).andExpect(status().isForbidden());
  http.perform(get("/api/intercession").header("Authorization",auth(executive))).andExpect(status().isOk()).andExpect(jsonPath("$.canViewTeam").value(true)).andExpect(jsonPath("$.canManage").value(false)).andExpect(jsonPath("$.canLead").value(false)).andExpect(jsonPath("$.team.length()").value(1)).andExpect(jsonPath("$.candidates").isEmpty());
  http.perform(put("/api/intercession/team").header("Authorization",auth(executive)).contentType("application/json").content("{\"revision\":1,\"userIds\":[]}")).andExpect(status().isForbidden());
 }
 @Test void teacherMembershipControlsMenusAndPrivatePrayerRequestsStayWithTheTeam() throws Exception {
  for(var u:List.of(member,outsider)){
   boolean joined=u.getId().equals(member.getId());
   http.perform(get("/api/officers/me").header("Authorization",auth(u))).andExpect(jsonPath("$.canPraise").value(joined)).andExpect(jsonPath("$.canIntercession").value(joined)).andExpect(jsonPath("$.canNewFamily").value(joined));
  }
  http.perform(get("/api/praise").param("term",String.valueOf(term)).header("Authorization",auth(outsider))).andExpect(status().isForbidden());
  http.perform(get("/api/new-family/people").header("Authorization",auth(outsider))).andExpect(status().isForbidden());
  http.perform(get("/api/new-family/team").header("Authorization",auth(outsider))).andExpect(status().isForbidden());
  http.perform(get("/api/intercession").header("Authorization",auth(outsider))).andExpect(jsonPath("$.canViewTeam").value(false)).andExpect(jsonPath("$.team").isEmpty());
  var request=intercession.submit(new IntercessionService.RequestInput("가상 비공개 요청","팀에서만 확인할 가상 내용","기타",false,null,false,true),outsider);
  http.perform(get("/api/intercession/requests/{id}",request.id()).header("Authorization",auth(executive))).andExpect(status().isNotFound());
  http.perform(get("/api/intercession/requests").param("scope","inbox").header("Authorization",auth(executive))).andExpect(status().isForbidden());
  http.perform(get("/api/intercession/requests/{id}",request.id()).header("Authorization",auth(member))).andExpect(status().isOk());
 }
 @Test void losingExecutiveRoleImmediatelyRemovesUnassignedTeamAccess() throws Exception {
  var u=users.findById(executive.getId()).orElseThrow();u.updateRole(User.Role.TEACHER);users.flush();
  var capability=offices.capability(u);assertFalse(capability.canPraise());assertFalse(capability.canNewFamily());assertFalse(capability.canIntercession());
  http.perform(get("/api/praise").param("term",String.valueOf(term)).header("Authorization",auth(u))).andExpect(status().isForbidden());
  http.perform(get("/api/new-family/people").header("Authorization",auth(u))).andExpect(status().isForbidden());
 }
}
