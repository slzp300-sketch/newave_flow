package com.newaveflow;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import com.newaveflow.service.IntercessionService.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.exception.AppException;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class IntercessionHttpTest {
 @Autowired IntercessionService service; @Autowired OfficerOrganizationService offices; @Autowired UserRepository users;
 @Autowired CommunityAgreementRepository agreements; @Autowired JwtTokenProvider tokens; @Autowired MockMvc http;
 @Autowired PrayerVoteRepository votes; @Autowired IntercessionRequestRepository requests; @Autowired jakarta.persistence.EntityManager em;
 @MockBean Clock clock;
 User admin,chair,member,teacher,other; LocalDate week=LocalDate.of(2026,11,2),thu=week.plusDays(3);
 User user(String name,User.Role role){var u=users.saveAndFlush(User.builder().name(name).email(UUID.randomUUID()+"@example.invalid").role(role).build());agreements.saveAndFlush(new CommunityAgreement(u.getId(),CommunitySafetyService.POLICY_VERSION));return u;}
 String auth(User u){u=users.findById(u.getId()).orElseThrow();return "Bearer "+tokens.createAccessToken(u.getId(),u.getEmail(),u.getRole().name(),u.getAuthVersion());}
 RequestView submit(boolean share,boolean anonymous){return service.submit(new RequestInput("원문 비밀제목","원문 비밀내용","학생",false,null,share,anonymous),teacher);}
 RequestView publish(RequestView r){return service.review(r.id(),new ReviewInput(r.revision(),"PUBLISH","함께 기도","공개 기도내용",r.anonymous()),member);}
 MeetingView meeting(){return service.state(week,member).meetings().get(1);}
 @BeforeEach void setup(){
  when(clock.instant()).thenReturn(Instant.parse("2026-11-04T00:00:00Z"));when(clock.getZone()).thenReturn(ZoneId.of("Asia/Seoul"));
  admin=user("가상관리",User.Role.ADMIN);chair=user("가상팀장",User.Role.EXECUTIVE);member=user("가상팀원",User.Role.TEACHER);teacher=user("가상제출교사",User.Role.TEACHER);other=user("가상다른교사",User.Role.TEACHER);
  var org=offices.get(null,admin);offices.assign(org.activeYear(),OfficerPosition.INTERCESSION,new OfficerOrganizationService.Assignment(org.revision(),chair.getId()),admin);
  service.members(new MemberInput(0L,List.of(member.getId(),chair.getId())),chair);
 }
 @Test void roleCapabilitiesAndServerAuthorization()throws Exception {
  assertTrue(offices.capability(member).canIntercession());assertFalse(offices.capability(teacher).canIntercession());
  http.perform(get("/api/intercession")).andExpect(status().isUnauthorized());
  http.perform(get("/api/intercession").header("Authorization",auth(teacher))).andExpect(status().isOk()).andExpect(jsonPath("$.canManage").value(false)).andExpect(jsonPath("$.candidates").isEmpty()).andExpect(jsonPath("$.team").isEmpty());
  http.perform(get("/api/intercession/requests").param("scope","inbox").header("Authorization",auth(teacher))).andExpect(status().isForbidden());
  http.perform(put("/api/intercession/team").contentType("application/json").content("{\"revision\":1,\"userIds\":[]}").header("Authorization",auth(member))).andExpect(status().isForbidden());
  assertThrows(AppException.class,()->service.submit(new RequestInput("제목","내용","교사",true,"대리이름",true,true),teacher));
  assertThrows(AppException.class,()->service.configure(thu,new MeetingInput(0L,null,45,null,""),teacher));
 }
 @Test void originalPrivateAndAnonymousDataNeverReachPublicResponses()throws Exception {
  var privateRequest=submit(false,true);
  http.perform(get("/api/intercession/requests/"+privateRequest.id()).header("Authorization",auth(other))).andExpect(status().isNotFound());
  assertThrows(AppException.class,()->publish(privateRequest));
  var r=publish(submit(true,true));
  http.perform(get("/api/intercession/requests/"+r.id()).header("Authorization",auth(other))).andExpect(jsonPath("$.title").isEmpty()).andExpect(jsonPath("$.body").isEmpty()).andExpect(jsonPath("$.author").isEmpty()).andExpect(jsonPath("$.source").isEmpty()).andExpect(jsonPath("$.publicText").value("공개 기도내용"));
  var publicText=http.perform(get("/api/intercession/requests").header("Authorization",auth(other))).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1)).andReturn().getResponse().getContentAsString();
  assertFalse(publicText.contains("원문 비밀"));assertFalse(publicText.contains("가상제출교사"));
  assertEquals(0,service.list("board","all","원문 비밀",0,other).total());
  assertEquals(2,service.list("mine","all","",0,teacher).total());
  assertEquals(0,service.list("mine","all","",0,other).total());
  assertTrue(service.detail(r.id(),teacher).canReadOriginal());
  assertThrows(AppException.class,()->service.review(r.id(),new ReviewInput(r.revision(),"PUBLISH","제목","내용",false),member));
 }
 @Test void proxyRequestsAndNonAnonymousPublicAuthor(){
  var r=service.submit(new RequestInput("대리 요청","카톡 원문","교사",true,"외부 가상교사",true,false),member);
  r=publish(r);assertEquals("외부 가상교사",service.detail(r.id(),other).author());assertNull(service.detail(r.id(),other).source());
  assertEquals("카톡",service.detail(r.id(),member).source());
 }
 @Test void voteTotalsAndMeetingSettingsUseExistingTuesdayThursdayData()throws Exception{
  votes.saveAndFlush(PrayerVote.builder().teacher(teacher).weekStart(week).status(PrayerVote.Status.TUE).reason("공개되면 안 되는 불참사유").build());
  votes.saveAndFlush(PrayerVote.builder().teacher(other).weekStart(week).status(PrayerVote.Status.THU).build());
  service.configure(thu,new MeetingInput(0L,LocalTime.of(22,0),45,member.getId(),"https://us02web.zoom.us/j/123"),chair);
  var s=service.state(week,teacher);assertEquals(1,s.meetings().get(0).voters());assertEquals(1,s.meetings().get(1).voters());assertEquals(LocalTime.of(22,0),s.meetings().get(1).time());
  var body=http.perform(get("/api/intercession").param("week",week.toString()).header("Authorization",auth(teacher))).andExpect(header().string("Cache-Control","no-store")).andReturn().getResponse().getContentAsString();
  assertFalse(body.contains("불참사유"));
  assertThrows(AppException.class,()->service.configure(week,new MeetingInput(0L,null,45,null,""),member));
  for(String url:List.of("http://zoom.us/j/1","https://zoom.us.attacker.invalid/j/1","https://user@zoom.us/j/1","https://zoom.us:444/j/1","javascript:alert(1)"))
   assertThrows(AppException.class,()->service.configure(thu,new MeetingInput(1L,null,45,null,url),member));
  assertThrows(AppException.class,()->service.configure(thu,new MeetingInput(0L,null,45,null,""),member));
  assertThrows(AppException.class,()->service.configure(thu,new MeetingInput(1L,null,45,teacher.getId(),""),member));
 }
 @Test void materialOrderSnapshotAndWithdrawalRemainSafe(){
  var a=publish(submit(true,true));var b=publish(submit(true,true));
  service.materials(thu,new MaterialsInput(0L,List.of(b.id(),a.id())),member);
  service.prepare(thu,new Revision(1L),member);
  assertEquals(List.of(b.id(),a.id()),meeting().paper().stream().map(PaperItem::id).toList());
  assertNull(meeting().paper().get(0).author());assertEquals("공개 기도내용",meeting().paper().get(0).body());
  assertTrue(service.state(week,teacher).meetings().get(1).paper().isEmpty());
  service.withdraw(a.id(),new Revision(a.revision()),teacher);
  assertTrue(meeting().paperStale());assertTrue(meeting().paper().isEmpty());assertEquals(1,meeting().selected().size());
  assertThrows(AppException.class,()->service.prepare(thu,new Revision(2L),member));
  service.materials(thu,new MaterialsInput(2L,List.of(b.id())),member);service.prepare(thu,new Revision(3L),member);
  assertEquals(1,meeting().paper().size());
  b=service.review(b.id(),new ReviewInput(b.revision(),"ANSWER","","",true),member);
  assertEquals(1,service.list("board","answered","",0,teacher).total());assertTrue(meeting().paperStale());
 }
 @Test void privateOrDuplicateMaterialIdsAndStaleRequestEditsFail(){
  var p=submit(false,true);var a=publish(submit(true,true));
  assertThrows(AppException.class,()->service.materials(thu,new MaterialsInput(0L,List.of(p.id())),member));
  assertThrows(AppException.class,()->service.materials(thu,new MaterialsInput(0L,List.of(a.id(),a.id())),member));
  assertThrows(AppException.class,()->service.review(a.id(),new ReviewInput(0L,"PUBLISH","제목","내용",true),member));
  assertThrows(AppException.class,()->service.withdraw(a.id(),new Revision(a.revision()),other));
  service.review(a.id(),new ReviewInput(a.revision(),"SAVE","초안","수정 중",true),member);
  assertEquals(0,service.list("board","all","",0,teacher).total());
 }
 @Test void removedMemberAndFormerLeaderLoseAuthority(){
  service.configure(thu,new MeetingInput(0L,null,45,member.getId(),""),chair);
  service.members(new MemberInput(1L,List.of(chair.getId())),chair);
  assertFalse(service.canManage(member));assertEquals("진행자 재배정 필요",service.state(week,chair).meetings().get(1).hostName());
  assertThrows(AppException.class,()->service.materials(thu,new MaterialsInput(1L,List.of()),member));
  var org=offices.get(null,admin);offices.assign(org.activeYear(),OfficerPosition.INTERCESSION,new OfficerOrganizationService.Assignment(org.revision(),null),admin);
  assertFalse(service.canManage(chair));
 }
 @Test void listsArePagedAndSearchDoesNotTreatWildcardsAsUnbounded(){
  for(int i=0;i<31;i++)service.submit(new RequestInput("가상 "+i,"내용","기타",false,null,true,true),teacher);
  assertEquals(30,service.list("mine","all","",0,teacher).items().size());assertEquals(1,service.list("mine","all","",1,teacher).items().size());
  assertEquals(0,service.list("mine","all","%",0,teacher).total());assertEquals(31,service.list("inbox","pending","가상",0,member).total());
 }
}
