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
 @Autowired PrayerParticipationService participation; @Autowired IntercessionMeetingRepository meetings;
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
  var s=service.state(week,teacher);assertEquals(1,s.meetings().get(0).voters());assertEquals(1,s.meetings().get(1).voters());assertEquals(LocalTime.of(21,30),s.meetings().get(1).time());
  assertEquals(LocalTime.of(21,30),meetings.findById(thu).orElseThrow().getStartTime());
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
 @Test void fixedStartTimeAppliesBeforeSetupAndToLegacySettings(){
  for(var m:service.state(week.plusWeeks(1),teacher).meetings())assertEquals(LocalTime.of(21,30),m.time());
  var legacy=new IntercessionMeeting();legacy.setMeetingDate(thu);legacy.setStartTime(null);meetings.saveAndFlush(legacy);
  assertEquals(LocalTime.of(21,30),meeting().time());
  service.configure(thu,new MeetingInput(0L,LocalTime.of(18,0),30,null,""),chair);
  assertEquals(LocalTime.of(21,30),meeting().time());assertEquals(30,meeting().duration());
 }
 @Test void cancellationAndRestorationPreserveVotesStatisticsAndPreparedMaterials()throws Exception{
  var vote=votes.saveAndFlush(PrayerVote.builder().teacher(teacher).weekStart(week).status(PrayerVote.Status.THU).reason("기존 응답 사유").build());
  votes.saveAndFlush(PrayerVote.builder().teacher(other).weekStart(week).status(PrayerVote.Status.ABSENT).reason("기존 불참 사유").build());
  em.clear();var voteTime=votes.findById(vote.getId()).orElseThrow().getUpdatedAt();var before=participation.get(week);
  var r=publish(submit(true,true));service.materials(thu,new MaterialsInput(0L,List.of(r.id())),member);service.prepare(thu,new Revision(1L),member);
  var paper=meeting().paper();var preparedAt=meeting().preparedAt();
  http.perform(put("/api/intercession/meetings/"+thu).header("Authorization",auth(member)).contentType("application/json")
   .content("{\"revision\":2,\"startTime\":\"20:00\",\"duration\":45,\"canceled\":true,\"cancellationReason\":\"교회 행사\"}"))
   .andExpect(status().isOk()).andExpect(jsonPath("$.meetings[1].canceled").value(true)).andExpect(jsonPath("$.meetings[1].cancellationReason").value("교회 행사"));
  assertFalse(service.state(week,teacher).meetings().get(0).canceled());assertEquals(1,meeting().voters());
  assertEquals(before.summary(),participation.get(week).summary());assertEquals(before.trend(),participation.get(week).trend());
  assertEquals(paper,meeting().paper());assertEquals(preparedAt,meeting().preparedAt());
  var unchanged=votes.findById(vote.getId()).orElseThrow();assertEquals(PrayerVote.Status.THU,unchanged.getStatus());assertEquals("기존 응답 사유",unchanged.getReason());assertEquals(voteTime,unchanged.getUpdatedAt());
  // Old app versions cannot silently clear a cancellation when saving their legacy form.
  http.perform(put("/api/intercession/meetings/"+thu).header("Authorization",auth(chair)).contentType("application/json")
   .content("{\"revision\":3,\"duration\":60}"))
   .andExpect(status().isOk()).andExpect(jsonPath("$.meetings[1].canceled").value(true)).andExpect(jsonPath("$.meetings[1].cancellationReason").value("교회 행사"));
  service.configure(thu,new MeetingInput(4L,null,45,member.getId(),"",false,"남기지 않을 사유"),chair);
  assertFalse(meeting().canceled());assertEquals("",meeting().cancellationReason());assertEquals(LocalTime.of(21,30),meeting().time());
  assertEquals(paper,meeting().paper());assertEquals(before.summary(),participation.get(week).summary());
 }
 @Test void cancellationRequiresTeamPermissionCurrentRevisionAndValidReason()throws Exception{
  String change="{\"revision\":0,\"duration\":45,\"canceled\":true,\"cancellationReason\":\"행사\"}";
  http.perform(put("/api/intercession/meetings/"+thu).header("Authorization",auth(teacher)).contentType("application/json").content(change)).andExpect(status().isForbidden());
  assertThrows(AppException.class,()->service.configure(thu,new MeetingInput(0L,null,45,null,"",true,"가".repeat(121)),member));
  assertFalse(meeting().canceled());assertEquals(0,meeting().revision());
  service.configure(thu,new MeetingInput(0L,null,45,null,"",true,""),member);
  assertTrue(meeting().canceled());
  assertThrows(AppException.class,()->service.configure(thu,new MeetingInput(0L,null,45,null,"",false,""),member));
  assertTrue(meeting().canceled());
 }
 @Test void listsArePagedAndSearchDoesNotTreatWildcardsAsUnbounded(){
  for(int i=0;i<31;i++)service.submit(new RequestInput("가상 "+i,"내용","기타",false,null,true,true),teacher);
  assertEquals(30,service.list("mine","all","",0,teacher).items().size());assertEquals(1,service.list("mine","all","",1,teacher).items().size());
  assertEquals(0,service.list("mine","all","%",0,teacher).total());assertEquals(31,service.list("inbox","pending","가상",0,member).total());
 }
 @Test void decisionsSeparateSharingFromCompletionAndAllowResuming(){
  var r=submit(true,true);
  r=service.decide(r.id(),new DecisionInput(r.revision(),false,false,null,null,null),member);
  assertEquals("ready",r.state());assertFalse(r.completed());assertEquals(0,service.state(week,member).pending());
  assertEquals(1,service.list("inbox","ongoing","",0,member).total());assertEquals(0,service.list("board","all","",0,other).total());
  r=service.decide(r.id(),new DecisionInput(r.revision(),false,true,null,null,null),member);
  assertTrue(r.completed());assertEquals(0,service.list("inbox","ongoing","",0,member).total());assertEquals(1,service.list("inbox","completed","",0,member).total());
  assertEquals(0,service.list("board","completed","",0,other).total());
  r=service.decide(r.id(),new DecisionInput(r.revision(),true,true,"공개 제목","공개 내용",true),member);
  assertEquals("answered",r.state());assertNull(service.detail(r.id(),other).body());assertNull(service.detail(r.id(),other).author());assertTrue(service.detail(r.id(),other).completed());
  // An old client's content edit must not silently reopen a finished prayer.
  r=service.review(r.id(),new ReviewInput(r.revision(),"PUBLISH","수정 제목","수정 내용",true),member);
  assertTrue(r.completed());assertEquals("answered",r.state());
  r=service.decide(r.id(),new DecisionInput(r.revision(),true,false,null,null,null),member);
  assertFalse(r.completed());assertEquals("published",r.state());assertEquals(1,service.list("board","ongoing","",0,other).total());
 }
 @Test void completedPrayersLeaveMeetingMaterialsAndCannotBePreparedUntilResumed(){
  var r=publish(submit(true,true));service.materials(thu,new MaterialsInput(0L,List.of(r.id())),member);service.prepare(thu,new Revision(1L),member);
  r=service.decide(r.id(),new DecisionInput(r.revision(),true,true,null,null,null),member);
  assertTrue(meeting().selected().isEmpty());assertTrue(meeting().paperStale());assertTrue(meeting().paper().isEmpty());
  assertThrows(AppException.class,()->service.prepare(thu,new Revision(2L),member));
  r=service.decide(r.id(),new DecisionInput(r.revision(),true,false,null,null,null),member);
  assertEquals(1,meeting().selected().size());assertTrue(meeting().paperStale());
  service.prepare(thu,new Revision(2L),member);assertEquals(1,meeting().paper().size());
 }
 @Test void decisionEndpointEnforcesConsentAuthorityAndRevision()throws Exception{
  var r=submit(false,true);String path="/api/intercession/requests/"+r.id()+"/decision";
  http.perform(put(path).header("Authorization",auth(teacher)).contentType("application/json").content("{\"revision\":0,\"publish\":false,\"completed\":true}")).andExpect(status().isForbidden());
  http.perform(put(path).header("Authorization",auth(member)).contentType("application/json").content("{\"revision\":0,\"publish\":true,\"completed\":true}")).andExpect(status().isForbidden());
  http.perform(put(path).header("Authorization",auth(member)).contentType("application/json").content("{\"revision\":0,\"publish\":false}")).andExpect(status().isBadRequest());
  http.perform(put(path).header("Authorization",auth(member)).contentType("application/json").content("{\"revision\":0,\"publish\":false,\"completed\":true}")).andExpect(status().isOk()).andExpect(jsonPath("$.completed").value(true)).andExpect(jsonPath("$.state").value("ready"));
  http.perform(put(path).header("Authorization",auth(member)).contentType("application/json").content("{\"revision\":0,\"publish\":false,\"completed\":false}")).andExpect(status().isConflict());
  http.perform(get("/api/intercession/requests/"+r.id()).header("Authorization",auth(other))).andExpect(status().isNotFound());
  r=service.detail(r.id(),member);var current=r;
  assertThrows(AppException.class,()->service.decide(current.id(),new DecisionInput(current.revision(),false,true,null,null,false),member));
  service.withdraw(r.id(),new Revision(r.revision()),member);
  http.perform(put(path).header("Authorization",auth(member)).contentType("application/json").content("{\"revision\":2,\"publish\":false,\"completed\":false}")).andExpect(status().isConflict());
 }
 @Test void ownerUpdatesStayPrivateUntilTeamReview()throws Exception{
  var r=publish(submit(true,true));String path="/api/intercession/requests/"+r.id();
  http.perform(put(path+"/update").header("Authorization",auth(teacher)).contentType("application/json")
   .content("{\"revision\":1,\"title\":\"새 원문\",\"body\":\"비공개 수정 내용\",\"note\":\"비공개 근황\"}"))
   .andExpect(status().isOk()).andExpect(jsonPath("$.pendingUpdate.note").value("비공개 근황")).andExpect(jsonPath("$.publicText").value("공개 기도내용")).andExpect(jsonPath("$.title").value("원문 비밀제목"));
  assertEquals(1,service.state(week,member).pending());assertEquals(1,service.list("inbox","pending","",0,member).total());
  http.perform(get(path).header("Authorization",auth(other))).andExpect(jsonPath("$.pendingUpdate").isEmpty()).andExpect(jsonPath("$.updates").isEmpty()).andExpect(jsonPath("$.publicText").value("공개 기도내용"));
  for(var u:List.of(other,teacher,member)){
   var board=service.list("board","all","",0,u).items().get(0);assertNull(board.pendingUpdate());assertTrue(board.updates().isEmpty());assertNull(board.body());
  }
  assertEquals(0,service.list("board","all","비공개 근황",0,other).total());
  http.perform(put(path+"/update-review").header("Authorization",auth(member)).contentType("application/json")
   .content("{\"revision\":2,\"updatePublic\":true,\"publicTitle\":\"팀에서 확인한 제목\",\"publicText\":\"공개 가능한 근황만\"}"))
   .andExpect(status().isOk()).andExpect(jsonPath("$.pendingUpdate").isEmpty()).andExpect(jsonPath("$.updates[0].shared").value(true));
  assertEquals(0,service.state(week,member).pending());assertEquals(0,service.list("inbox","pending","",0,member).total());
  var own=service.detail(r.id(),teacher);assertEquals("새 원문",own.title());assertEquals("비공개 근황",own.updates().get(0).update().note());
  var shared=service.detail(r.id(),other);assertEquals("공개 가능한 근황만",shared.publicText());assertNull(shared.author());assertNull(shared.pendingUpdate());assertTrue(shared.updates().isEmpty());
 }
 @Test void keepingSharedContentPreservesStateConsentAndPrivateHistory(){
  var r=publish(submit(true,true));r=service.decide(r.id(),new DecisionInput(r.revision(),true,true,null,null,null),member);
  r=service.updateRequest(r.id(),new UpdateInput(r.revision(),"수정 원문","수정 내용","근황"),teacher);
  assertEquals(1,service.list("inbox","pending","",0,member).total());
  r=service.reviewUpdate(r.id(),new UpdateReviewInput(r.revision(),false,null,null),member);
  assertEquals("공개 기도내용",r.publicText());assertEquals("answered",r.state());assertTrue(r.completed());assertTrue(r.anonymous());assertTrue(r.share());assertFalse(r.updates().get(0).shared());
  assertEquals(1,service.list("board","answered","",0,other).total());
  r=service.updateRequest(r.id(),new UpdateInput(r.revision(),r.title(),r.body(),"두 번째 근황"),teacher);
  r=service.reviewUpdate(r.id(),new UpdateReviewInput(r.revision(),true,"정리한 제목","정리한 내용"),member);
  assertEquals("answered",r.state());assertTrue(r.completed());assertEquals(2,r.updates().size());
 }
 @Test void updateAuthorityRevisionAndValidationAreEnforced()throws Exception{
  var r=publish(submit(true,true));String path="/api/intercession/requests/"+r.id();
  String payload="{\"revision\":1,\"title\":\"수정 제목\",\"body\":\"수정 내용\",\"note\":\"근황\"}";
  for(var u:List.of(other,member,admin))http.perform(put(path+"/update").header("Authorization",auth(u)).contentType("application/json").content(payload)).andExpect(status().isForbidden());
  for(var input:List.of(new UpdateInput(1L,"","내용",""),new UpdateInput(1L,"제목","",""),new UpdateInput(1L,"원문 비밀제목","원문 비밀내용",""),new UpdateInput(1L,"가".repeat(81),"내용",""),new UpdateInput(1L,"제목","가".repeat(2001),""),new UpdateInput(1L,"제목","내용","가".repeat(2001))))
   assertThrows(AppException.class,()->service.updateRequest(r.id(),input,teacher));
  assertThrows(AppException.class,()->service.updateRequest(r.id(),new UpdateInput(0L,"제목","내용",""),teacher));
  service.updateRequest(r.id(),new UpdateInput(1L,"제목","내용","근황"),teacher);
  http.perform(put(path+"/update-review").header("Authorization",auth(teacher)).contentType("application/json").content("{\"revision\":2,\"updatePublic\":false}")).andExpect(status().isForbidden());
  http.perform(put(path+"/update-review").header("Authorization",auth(member)).contentType("application/json").content("{\"revision\":2}")).andExpect(status().isBadRequest());
  assertThrows(AppException.class,()->service.reviewUpdate(r.id(),new UpdateReviewInput(1L,false,null,null),member));
  assertThrows(AppException.class,()->service.reviewUpdate(r.id(),new UpdateReviewInput(2L,true,"",""),member));
  assertThrows(AppException.class,()->service.review(r.id(),new ReviewInput(2L,"PUBLISH","제목","내용",true),member));
  assertThrows(AppException.class,()->service.decide(r.id(),new DecisionInput(2L,true,false,null,null,null),member));
  assertEquals("원문 비밀제목",service.detail(r.id(),teacher).title());
 }
 @Test void privateAndInitiallyPendingUpdatesAreReviewedInOneStep(){
  var p=submit(false,true);p=service.updateRequest(p.id(),new UpdateInput(p.revision(),"새 제목","새 내용","근황"),teacher);
  var pending=p;assertThrows(AppException.class,()->service.reviewUpdate(pending.id(),new UpdateReviewInput(pending.revision(),true,"제목","내용"),member));
  assertEquals(1,service.state(week,member).pending());
  p=service.reviewUpdate(p.id(),new UpdateReviewInput(p.revision(),false,null,null),member);
  assertEquals("ready",p.state());assertFalse(p.share());assertEquals(0,service.state(week,member).pending());
  assertEquals(0,service.list("board","all","",0,other).total());
  var shared=submit(true,false);shared=service.updateRequest(shared.id(),new UpdateInput(shared.revision(),"새 제목","새 내용","근황"),teacher);
  shared=service.reviewUpdate(shared.id(),new UpdateReviewInput(shared.revision(),true,"공개 제목","공개 내용"),member);
  assertEquals("published",shared.state());assertFalse(shared.anonymous());assertEquals(0,service.state(week,member).pending());
 }
 @Test void replacingPendingUpdateUsesLatestRevisionAndWithdrawalRemovesQueue(){
  var r=publish(submit(true,true));r=service.updateRequest(r.id(),new UpdateInput(r.revision(),r.title(),r.body(),"처음 근황"),teacher);
  var old=r;r=service.updateRequest(r.id(),new UpdateInput(r.revision(),r.title(),r.body(),"최신 근황"),teacher);
  assertEquals("최신 근황",r.pendingUpdate().note());assertEquals(1,service.state(week,member).pending());
  assertThrows(AppException.class,()->service.reviewUpdate(old.id(),new UpdateReviewInput(old.revision(),false,null,null),member));
  r=service.withdraw(r.id(),new Revision(r.revision()),teacher);assertNull(r.pendingUpdate());assertEquals(0,service.state(week,member).pending());
  var removed=r;assertThrows(AppException.class,()->service.updateRequest(removed.id(),new UpdateInput(removed.revision(),"제목","내용",""),teacher));
  assertThrows(AppException.class,()->service.reviewUpdate(removed.id(),new UpdateReviewInput(removed.revision(),false,null,null),member));
 }
 @Test void rebuildingMaterialsAutomaticallyOmitsCompletedRequests(){
  var finished=publish(submit(true,true));var continuing=publish(submit(true,true));
  service.materials(thu,new MaterialsInput(0L,List.of(finished.id(),continuing.id())),member);service.prepare(thu,new Revision(1L),member);
  service.decide(finished.id(),new DecisionInput(finished.revision(),true,true,null,null,null),member);
  service.prepare(thu,new Revision(2L),member);
  assertEquals(List.of(continuing.id()),meeting().paper().stream().map(PaperItem::id).toList());
  assertEquals(List.of(continuing.id()),meeting().selected().stream().map(RequestView::id).toList());assertFalse(meeting().paperStale());
 }
}
