package com.newaveflow;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.*;
import com.newaveflow.dto.tts.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class WidgetHttpTest {
 @Autowired MockMvc http; @Autowired ObjectMapper json; @Autowired WidgetService widgets; @Autowired TtsService tts;
 @Autowired UserRepository users; @Autowired TtsQuestionRepository questions; @Autowired CommunityAgreementRepository agreements;
 @Autowired JwtTokenProvider tokens; @Autowired EventRepository events; @Autowired PrayerVoteRepository prayers;
 User teacher, other; TtsQuestion daily, linked; LocalDate date=LocalDate.of(2026,11,11), sunday=LocalDate.of(2026,11,8);
 User user(String name){var u=users.saveAndFlush(User.builder().name(name).email(UUID.randomUUID()+"@example.invalid").role(User.Role.TEACHER).build());agreements.saveAndFlush(new CommunityAgreement(u.getId(),CommunitySafetyService.POLICY_VERSION));return u;}
 String auth(User u){return "Bearer "+tokens.createAccessToken(u.getId(),u.getEmail(),u.getRole().name(),u.getAuthVersion());}
 String credential(){return widgets.connect(teacher).token();}
 String body(boolean value){return "{\"date\":\"2026-11-11\",\"questionId\":"+daily.getId()+",\"checked\":"+value+",\"expectedChecked\":"+!value+"}";}
 @BeforeEach void setup(){
  var fixed=Clock.fixed(date.atTime(12,0).atZone(WidgetService.ZONE).toInstant(),WidgetService.ZONE);
  ReflectionTestUtils.setField(widgets,"clock",fixed);ReflectionTestUtils.setField(tts,"clock",fixed);
  teacher=user("가상위젯교사");other=user("가상다른교사");
  daily=questions.saveAndFlush(TtsQuestion.builder().title("가상 영성 체크").type(TtsQuestion.TtsQuestionType.DAYS).displayOrder(900).linkType(TtsQuestion.TtsLinkType.NONE).build());
  linked=questions.saveAndFlush(TtsQuestion.builder().title("가상 연동 체크").type(TtsQuestion.TtsQuestionType.ATTEND).displayOrder(901).linkType(TtsQuestion.TtsLinkType.PRAYER_MEETING).build());
 }
 @AfterEach void reset(){ReflectionTestUtils.setField(widgets,"clock",Clock.system(WidgetService.ZONE));ReflectionTestUtils.setField(tts,"clock",Clock.system(TtsPeriod.ZONE));}
 @Test void credentialHasOnlyWidgetPurposeAndCannotBecomeLoginOrGeneralApiAccess()throws Exception{
  String token=credential();assertEquals("widget",tokens.requireToken(token,"widget").get("purpose"));assertNull(tokens.getClaims(token).get("email"));
  http.perform(get("/api/users/me").header("Authorization","Bearer "+token)).andExpect(status().isUnauthorized());
  http.perform(post("/api/auth/refresh").contentType("application/json").content("{\"refreshToken\":\""+token+"\"}")).andExpect(status().isUnauthorized());
  http.perform(get("/api/widgets/snapshot")).andExpect(status().isUnauthorized());
  http.perform(post("/api/widgets/session")).andExpect(status().isUnauthorized());
  http.perform(get("/api/widgets/snapshot").header("X-Newave-Widget",tokens.createAccessToken(teacher.getId(),teacher.getEmail(),"TEACHER",0))).andExpect(status().isUnauthorized());
  http.perform(get("/api/widgets/snapshot").header("X-Newave-Widget",token)).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"));
 }
 @Test void widgetChangesOnlyTheCurrentUsersCurrentDayAndKeepsOtherDays()throws Exception{
  tts.saveFields(teacher,new TtsFieldAnswerRequest(sunday,daily.getId(),Map.of("월",true),null));
  String token=credential();
  http.perform(put("/api/widgets/check").header("X-Newave-Widget",token).contentType("application/json").content(body(true))).andExpect(status().isOk());
  var raw=tts.getWeek(teacher,date).getAnswers().stream().filter(a->a.getQuestionId().equals(daily.getId())).findFirst().orElseThrow().getAnswerData();
  assertTrue(json.readTree(raw).path("월").asBoolean());assertTrue(json.readTree(raw).path("수").asBoolean());
  assertTrue(tts.getWeek(other,date).getAnswers().isEmpty());
  // App field intent after a widget write retains the widget's Wednesday value.
  tts.saveFields(teacher,new TtsFieldAnswerRequest(sunday,daily.getId(),Map.of("화",true),null));
  raw=tts.getWeek(teacher,date).getAnswers().get(0).getAnswerData();assertTrue(json.readTree(raw).path("수").asBoolean());
  http.perform(put("/api/widgets/check").header("X-Newave-Widget",token).contentType("application/json").content(body(true))).andExpect(status().isOk());
 }
 @Test void staleDatesAndLinkedQuestionsCannotBeWritten()throws Exception{
  String token=credential();
  for(String invalid:List.of(body(true).replace("2026-11-11","2026-11-10"),body(true).replace("2026-11-11","2026-11-12")))
   http.perform(put("/api/widgets/check").header("X-Newave-Widget",token).contentType("application/json").content(invalid)).andExpect(status().isBadRequest());
  http.perform(put("/api/widgets/check").header("X-Newave-Widget",token).contentType("application/json").content(body(true).replace("\"questionId\":"+daily.getId(),"\"questionId\":"+linked.getId()))).andExpect(status().isForbidden());
  assertTrue(tts.getWeek(teacher,date).getAnswers().isEmpty());
 }
 @Test void logoutRoleChangeAndPolicyChangesRevokeWidgetAccess()throws Exception{
  String token=credential();teacher.revokeSessions();users.saveAndFlush(teacher);
  http.perform(get("/api/widgets/snapshot").header("X-Newave-Widget",token)).andExpect(status().isUnauthorized());
  token=credential();teacher.updateRole(User.Role.EXECUTIVE);users.saveAndFlush(teacher);
  http.perform(put("/api/widgets/check").header("X-Newave-Widget",token).contentType("application/json").content(body(true))).andExpect(status().isUnauthorized());
  token=credential();agreements.deleteById(teacher.getId());agreements.flush();
  http.perform(get("/api/widgets/snapshot").header("X-Newave-Widget",token)).andExpect(status().isPreconditionRequired());
 }
 @Test void snapshotContainsOnlyPersonalSummariesAndUpcomingPublicSchedule()throws Exception{
  events.saveAndFlush(Event.builder().title("가상 가까운 일정").eventDate(date.plusDays(1)).eventType(Event.EventType.REGULAR).build());
  events.saveAndFlush(Event.builder().title("지난 일정 제외").eventDate(date.minusDays(2)).eventType(Event.EventType.REGULAR).build());
  var snapshot=widgets.read(credential());assertEquals(date,snapshot.date());assertEquals("가상 가까운 일정",snapshot.events().get(0).title());
  assertEquals("none",snapshot.tasks().get(0).state());assertEquals("pending",snapshot.tasks().get(1).state());
  String data=json.writeValueAsString(snapshot);assertFalse(data.contains(teacher.getEmail()));assertFalse(data.contains(other.getName()));assertFalse(data.contains("token"));assertFalse(data.contains("지난 일정 제외"));
 }
 @Test void calendarContainsTheWholeMonthAndClipsMultiDayEventsAtMonthBoundaries(){
  events.saveAndFlush(Event.builder().title("가상 월 경계 일정").eventDate(date.withDayOfMonth(1).minusDays(2)).endDate(date.withDayOfMonth(2)).eventType(Event.EventType.REGULAR).build());
  events.saveAndFlush(Event.builder().title("가상 지난 일정").eventDate(date.withDayOfMonth(3)).eventType(Event.EventType.REGULAR).build());
  events.saveAndFlush(Event.builder().title("가상 월말 일정").eventDate(date.withDayOfMonth(29)).endDate(date.plusMonths(1).withDayOfMonth(3)).eventType(Event.EventType.REGULAR).build());
  var snapshot=widgets.read(credential());
  assertEquals(List.of(date.withDayOfMonth(1),date.withDayOfMonth(2),date.withDayOfMonth(3),date.withDayOfMonth(29),date.withDayOfMonth(30)),snapshot.calendarDates());
  assertTrue(snapshot.events().stream().noneMatch(e->e.title().equals("가상 지난 일정")));
  assertTrue(snapshot.events().size()<=3);
 }
 @Test void emptyMonthIsExplicitRatherThanMissing(){assertEquals(List.of(),widgets.read(credential()).calendarDates());}
 @Test void partialFieldsValidateValuesAndPreserveLegacyAndQuarterRules()throws Exception{
  http.perform(put("/api/tts/answer-fields").header("Authorization",auth(teacher)).contentType("application/json")
   .content("{\"weekStart\":\"2026-11-08\",\"questionId\":"+daily.getId()+",\"changes\":{\"수\":true}}" )).andExpect(status().isOk());
  assertThrows(com.newaveflow.exception.AppException.class,()->tts.saveFields(teacher,new TtsFieldAnswerRequest(sunday,daily.getId(),Map.of("토",true),null)));
  assertThrows(com.newaveflow.exception.AppException.class,()->tts.saveFields(teacher,new TtsFieldAnswerRequest(sunday,linked.getId(),null,true)));
 }
}
