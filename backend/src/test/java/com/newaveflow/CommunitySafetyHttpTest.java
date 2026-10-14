package com.newaveflow;

import com.fasterxml.jackson.databind.*;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.CommunitySafetyService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class CommunitySafetyHttpTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired ContentReportRepository reports;
    @Autowired CommunityAgreementRepository agreements;
    @Autowired MeetingMinuteRepository minutes;
    @Autowired ClassGroupRepository classes;
    @Autowired DailyReportRepository dailyReports;
    @Autowired JwtTokenProvider tokens;
    User teacher, other, admin, executive;
    @BeforeEach void setup() {
        teacher = account("safety-teacher", User.Role.TEACHER);
        other = account("safety-other", User.Role.TEACHER);
        admin = account("safety-admin", User.Role.ADMIN);
        executive = account("safety-executive", User.Role.EXECUTIVE);
    }
    User account(String name, User.Role role) {
        return users.saveAndFlush(User.builder().name(name).email(name+"@example.invalid").password("synthetic").role(role).build());
    }
    String token(User user) { return "Bearer " + tokens.createAccessToken(user.getId(), user.getEmail(), user.getRole().name(), user.getAuthVersion()); }
    String body(Object payload) throws Exception { return json.writeValueAsString(payload); }
    void accept(User user) throws Exception {
        http.perform(post("/api/safety/agreement").header("Authorization",token(user)).contentType("application/json")
            .content(body(Map.of("version", CommunitySafetyService.POLICY_VERSION, "accepted", true))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.accepted").value(true));
    }
    Map<String,Object> request(String requestId) {
        var payload = new LinkedHashMap<String,Object>();
        payload.put("targetType","CONTENT"); payload.put("contentType","OTHER"); payload.put("subject","Synthetic content");
        payload.put("reason","PRIVACY"); payload.put("details","Synthetic report only"); payload.put("requestId",requestId);
        return payload;
    }
    JsonNode create(User user, Map<String,Object> payload) throws Exception {
        return json.readTree(http.perform(post("/api/safety/reports").header("Authorization",token(user)).contentType("application/json").content(body(payload)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
    Map<String,Object> resolution(String status, String action, long revision) {
        return Map.of("status",status,"action",action,"note","Synthetic reviewed action", "expectedRevision",revision);
    }
    @Test void agreementIsExplicitAccountBoundVersionedAndRequiredByOldClientWrites() throws Exception {
        http.perform(get("/api/safety/policy")).andExpect(status().isOk()).andExpect(jsonPath("$.sections.length()").value(6));
        http.perform(post("/api/safety/agreement").contentType("application/json").content("{}" )).andExpect(status().isUnauthorized());
        http.perform(put("/api/users/me/profile").header("Authorization",token(teacher)).contentType("application/json").content("{\"name\":\"unsafe\"}"))
            .andExpect(status().isPreconditionRequired());
        http.perform(post("/api/safety/agreement").header("Authorization",token(teacher)).contentType("application/json")
            .content(body(Map.of("version","old-version","accepted",true)))).andExpect(status().isBadRequest());
        http.perform(post("/api/safety/agreement").header("Authorization",token(teacher)).contentType("application/json")
            .content(body(Map.of("version",CommunitySafetyService.POLICY_VERSION,"accepted",false)))).andExpect(status().isBadRequest());
        assertEquals(0, agreements.count());
        http.perform(post("/api/safety/agreement").header("Authorization",token(teacher)).contentType("application/json")
            .content(body(Map.of("version",CommunitySafetyService.POLICY_VERSION,"accepted",true,"userId",other.getId())))).andExpect(status().isOk());
        var first = agreements.findById(teacher.getId()).orElseThrow().getAcceptedAt();
        accept(teacher); assertEquals(first, agreements.findById(teacher.getId()).orElseThrow().getAcceptedAt());
        assertTrue(agreements.findById(other.getId()).isEmpty());
        http.perform(put("/api/users/me/profile").header("Authorization",token(teacher)).contentType("application/json").content("{\"name\":\"accepted\"}"))
            .andExpect(status().isOk());
        assertEquals("accepted",users.findById(teacher.getId()).orElseThrow().getName());
    }
    @Test void reportsWorkBeforeAgreementAndRemainPrivateToReporterAndManagement() throws Exception {
        var first = create(teacher,request(UUID.randomUUID().toString()));
        create(other,request(UUID.randomUUID().toString()));
        http.perform(get("/api/safety/reports")).andExpect(status().isUnauthorized());
        http.perform(get("/api/safety/reports").header("Authorization",token(teacher)).param("userId",other.getId().toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(1)).andExpect(jsonPath("$.content[0].id").value(first.get("id").asLong()));
        http.perform(get("/api/safety/admin/reports").header("Authorization",token(teacher))).andExpect(status().isForbidden());
        http.perform(get("/api/safety/admin/reports").header("Authorization",token(admin))).andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(2));
    }
    @Test void reportTargetMustBeVisibleAndMayNotProbeAnotherClassOrInactiveMinute() throws Exception {
        var minute=minutes.saveAndFlush(MeetingMinute.builder().title("Private synthetic minute").content("Synthetic").meetingDate(LocalDate.now()).isActive(false).build());
        var payload=request(UUID.randomUUID().toString()); payload.put("contentType","MEETING_MINUTE"); payload.put("targetId",minute.getId());
        http.perform(post("/api/safety/reports").header("Authorization",token(teacher)).contentType("application/json").content(body(payload))).andExpect(status().isNotFound());
        var group=classes.saveAndFlush(ClassGroup.builder().name("Another synthetic class").build());
        var daily=dailyReports.saveAndFlush(DailyReport.builder().classGroup(group).teacher(other).reportDate(LocalDate.now()).build());
        payload.put("contentType","DAILY_REPORT"); payload.put("targetId",daily.getId());
        http.perform(post("/api/safety/reports").header("Authorization",token(teacher)).contentType("application/json").content(body(payload))).andExpect(status().isForbidden());
        assertEquals(0,reports.count());
    }
    @Test void managementHidesMinuteAtomicallyAndRejectsUnauthorizedOrStaleResolution() throws Exception {
        var minute=minutes.saveAndFlush(MeetingMinute.builder().title("Synthetic minute").content("Keep original content").meetingDate(LocalDate.now()).build());
        var payload=request(UUID.randomUUID().toString()); payload.put("contentType","MEETING_MINUTE"); payload.put("targetId",minute.getId());
        var report=create(teacher,payload); String route="/api/safety/admin/reports/"+report.get("id").asLong();
        http.perform(patch(route).header("Authorization",token(teacher)).contentType("application/json").content(body(resolution("RESOLVED","HIDE_MINUTE",0)))).andExpect(status().isForbidden());
        http.perform(patch(route).header("Authorization",token(admin)).contentType("application/json").content(body(resolution("RESOLVED","HIDE_MINUTE",5)))).andExpect(status().isConflict());
        http.perform(patch(route).header("Authorization",token(admin)).contentType("application/json").content(body(resolution("RESOLVED","HIDE_MINUTE",0))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(1));
        assertFalse(minutes.findById(minute.getId()).orElseThrow().isActive());
        assertEquals("Keep original content",minutes.findById(minute.getId()).orElseThrow().getContent());
        http.perform(patch(route).header("Authorization",token(admin)).contentType("application/json").content(body(resolution("RESOLVED","HIDE_MINUTE",1)))).andExpect(status().isConflict());
    }
    @Test void userRestrictionRevokesTokensAndCannotTargetSelfOrEscalateExecutiveAuthority() throws Exception {
        var payload=request(UUID.randomUUID().toString()); payload.put("targetType","USER"); payload.remove("contentType"); payload.put("targetId",other.getId());
        var report=create(teacher,payload); String before=token(other);
        http.perform(patch("/api/safety/admin/reports/"+report.get("id").asLong()).header("Authorization",token(admin)).contentType("application/json")
            .content(body(resolution("RESOLVED","SUSPEND_USER",0)))).andExpect(status().isOk());
        http.perform(get("/api/users/me").header("Authorization",before)).andExpect(status().isUnauthorized());
        payload.put("requestId",UUID.randomUUID().toString()); payload.put("targetId",admin.getId());
        var privileged=create(teacher,payload);
        for(User actor:List.of(admin,executive)) http.perform(patch("/api/safety/admin/reports/"+privileged.get("id").asLong())
            .header("Authorization",token(actor)).contentType("application/json").content(body(resolution("RESOLVED","SUSPEND_USER",0)))).andExpect(status().isForbidden());
        assertTrue(users.findById(admin.getId()).orElseThrow().isActive());
    }
    @Test void uncertainResponsesAreIdempotentAndEditedRequestsCannotReuseIdAndQuotaIsEnforced() throws Exception {
        var payload=request(UUID.randomUUID().toString());
        assertEquals(create(teacher,payload).get("id"),create(teacher,payload).get("id"));
        payload.put("subject","Edited content");
        http.perform(post("/api/safety/reports").header("Authorization",token(teacher)).contentType("application/json").content(body(payload))).andExpect(status().isConflict());
        for(int i=1;i<10;i++) create(teacher,request(UUID.randomUUID().toString()));
        http.perform(post("/api/safety/reports").header("Authorization",token(teacher)).contentType("application/json").content(body(request(UUID.randomUUID().toString())))).andExpect(status().isBadRequest());
        assertEquals(10,reports.count());
    }
}
