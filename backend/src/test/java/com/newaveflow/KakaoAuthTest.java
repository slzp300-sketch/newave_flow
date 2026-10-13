package com.newaveflow;

import com.fasterxml.jackson.databind.*;
import com.newaveflow.config.KakaoProperties;
import com.newaveflow.dto.auth.*;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.net.URI;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"kakao.enabled=true", "kakao.client-id=synthetic-client", "kakao.client-secret=synthetic-secret",
    "kakao.admin-key=synthetic-admin", "kakao.app-id=1606088",
    "kakao.redirect-uri=http://localhost:8080/api/auth/kakao/callback", "kakao.web-return-uri=http://localhost:5173/auth/kakao/callback",
    "spring.datasource.url=jdbc:h2:mem:kakao_auth_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1"})
@ActiveProfiles("test") @AutoConfigureMockMvc @DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class KakaoAuthTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired KakaoAuthFlowRepository flows;
    @Autowired TtsRecordRepository records;
    @Autowired JwtTokenProvider tokens;
    @Autowired PasswordEncoder encoder;
    @Autowired KakaoProperties config;
    @MockBean KakaoClient kakao;
    static final String PASSWORD = "Synthetic!2026";
    static final String VERIFIER = "v".repeat(43);

    @BeforeEach void reset() {
        config.setEnabled(true); flows.deleteAllInBatch(); records.deleteAllInBatch(); users.deleteAllInBatch();
        org.mockito.Mockito.reset(kakao);
    }
    User account(String email, String kakaoId, boolean active) {
        return users.saveAndFlush(User.builder().name("검수 교사").email(email).password(encoder.encode(PASSWORD)).role(User.Role.TEACHER).isActive(active).kakaoId(kakaoId).build());
    }
    String access(User user) { return "Bearer " + tokens.createAccessToken(user.getId(), user.getEmail(), user.getRole().name(), user.getAuthVersion()); }
    KakaoCompleteRequest authorize(User user, String subject, boolean nativeClient) throws Exception {
        String path = user == null ? "/api/auth/kakao/start" : "/api/users/me/kakao/start";
        var request = post(path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new KakaoStartRequest(KakaoAuthService.challenge(VERIFIER), nativeClient ? "android" : "web", user == null ? null : PASSWORD)));
        if (user != null) request.header("Authorization", access(user));
        var started = json.readTree(http.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        var query = new URI(started.path("authorizationUrl").asText()).getRawQuery();
        String state = Arrays.stream(query.split("&")).filter(s -> s.startsWith("state=")).findFirst().orElseThrow().substring(6);
        when(kakao.identify("synthetic-code")).thenReturn(subject);
        String target = http.perform(get("/api/auth/kakao/callback").param("state", state).param("code", "synthetic-code"))
            .andExpect(status().isFound()).andExpect(header().string("Cache-Control", "no-store"))
            .andReturn().getResponse().getHeader("Location");
        assertFalse(target.contains("accessToken")); assertFalse(target.contains(PASSWORD));
        assertEquals(nativeClient ? "newaveflow" : "http", URI.create(target).getScheme());
        var params = new HashMap<String,String>();
        for (String part : URI.create(target).getFragment().split("&")) { String[] pair = part.split("=", 2); params.put(pair[0], pair[1]); }
        return new KakaoCompleteRequest(params.get("flow"), params.get("ticket"), VERIFIER);
    }
    JsonNode complete(KakaoCompleteRequest request, User user, int expected) throws Exception {
        var call = post("/api/auth/kakao/complete").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request));
        if (user != null) call.header("Authorization", access(user));
        var response = http.perform(call).andExpect(status().is(expected)).andReturn().getResponse();
        return json.readTree(response.getContentAsString());
    }

    @Test void existingConnectionKeepsIdPasswordRoleAndTtsRecords() throws Exception {
        var teacher = account("existing@example.invalid", null, true);
        var record = records.saveAndFlush(TtsRecord.builder().teacher(teacher).infoYear(2026).weekNum(42).isSubmitted(true).build());
        var proof = authorize(teacher, "9001", false);
        assertEquals("LINKED", complete(proof, teacher, 200).path("status").asText());
        assertEquals(teacher.getId(), users.findByKakaoId("9001").orElseThrow().getId());
        assertEquals(teacher.getId(), records.findById(record.getId()).orElseThrow().getTeacher().getId());
        var saved = users.findById(teacher.getId()).orElseThrow();
        assertEquals(User.Role.TEACHER, saved.getRole()); assertEquals(teacher.getPassword(), saved.getPassword());
        http.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new LoginRequest(saved.getEmail(), PASSWORD))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.user.id").value(saved.getId()));
        var login = complete(authorize(null, "9001", true), null, 200);
        assertEquals("SIGNED_IN", login.path("status").asText());
        assertEquals(saved.getId(), login.path("session").path("user").path("id").asLong());
        assertFalse(json.writeValueAsString(saved).contains("kakaoId"));
        complete(proof, teacher, 400); // Link handoff cannot be replayed.
    }

    @Test void signupNeverIssuesSessionAndApprovalIsRequiredForBothLoginMethods() throws Exception {
        var proof = authorize(null, "9002", false);
        var registration = complete(proof, null, 200);
        assertEquals("REGISTRATION_REQUIRED", registration.path("status").asText());
        assertFalse(registration.has("session"));
        var request = registrationRequest(proof, registration, "new@example.invalid");
        http.perform(post("/api/auth/kakao/register").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request))).andExpect(status().isCreated());
        var user = users.findByKakaoId("9002").orElseThrow();
        assertFalse(user.isActive()); assertEquals(User.Role.TEACHER, user.getRole());
        complete(authorize(null, "9002", false), null, 401);
        http.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new LoginRequest(user.getEmail(), PASSWORD)))).andExpect(status().isUnauthorized());
        user.approve(); users.saveAndFlush(user);
        var session = complete(authorize(null, "9002", false), null, 200);
        assertEquals(user.getId(), session.path("session").path("user").path("id").asLong());
        http.perform(post("/api/auth/kakao/register").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request))).andExpect(status().isBadRequest());
    }

    @Test void emailMatchDoesNotConnectOrOverwriteExistingAccount() throws Exception {
        var existing = account("same@example.invalid", null, true);
        var proof = authorize(null, "9003", false);
        var registration = complete(proof, null, 200);
        var request = registrationRequest(proof, registration, existing.getEmail());
        http.perform(post("/api/auth/kakao/register").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request))).andExpect(status().isConflict());
        assertNull(users.findById(existing.getId()).orElseThrow().getKakaoId()); assertEquals(1, users.count());
    }

    @Test void interceptedTicketWrongAccountAndChangedSessionCannotConnect() throws Exception {
        var owner = account("owner@example.invalid", null, true);
        var other = account("other@example.invalid", null, true);
        var proof = authorize(owner, "9004", true);
        complete(new KakaoCompleteRequest(proof.flowId(), proof.ticket(), "x".repeat(43)), owner, 400);
        complete(proof, other, 403);
        owner.revokeSessions(); users.saveAndFlush(owner);
        complete(proof, owner, 401);
        assertNull(users.findById(owner.getId()).orElseThrow().getKakaoId());
    }

    @Test void aKakaoAccountAlreadyOwnedByAnotherMemberCannotBeReassigned() throws Exception {
        var linked = account("linked@example.invalid", "9005", true);
        var other = account("second@example.invalid", null, true);
        complete(authorize(other, "9005", false), other, 409);
        assertEquals(linked.getId(), users.findByKakaoId("9005").orElseThrow().getId());
    }

    @Test void expirationInvalidStateAndMissingAuthenticationAreRejected() throws Exception {
        var proof = authorize(null, "9006", false);
        var flow = flows.findById(proof.flowId()).orElseThrow(); flow.setExpiresAt(Instant.now().minusSeconds(1)); flows.saveAndFlush(flow);
        complete(proof, null, 400);
        http.perform(get("/api/auth/kakao/callback").param("state", "invalid").param("code", "unused"))
            .andExpect(status().isFound()).andExpect(header().string("Location", "http://localhost:5173/auth/kakao/callback#error=expired"));
        http.perform(post("/api/users/me/kakao/start").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
        http.perform(get("/api/users/me/kakao")).andExpect(status().isUnauthorized());
        verify(kakao, times(1)).identify("synthetic-code");
    }

    @Test void featureOffKeepsEmailLoginAndNeverExposesCredentials() throws Exception {
        var user = account("fallback@example.invalid", null, true);
        config.setEnabled(false);
        String response = http.perform(get("/api/auth/kakao/config")).andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(false)).andReturn().getResponse().getContentAsString();
        assertFalse(response.contains("secret")); assertFalse(response.contains("client"));
        http.perform(post("/api/auth/kakao/start").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new KakaoStartRequest(KakaoAuthService.challenge(VERIFIER), "web", null)))).andExpect(status().isBadRequest());
        http.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new LoginRequest(user.getEmail(), PASSWORD)))).andExpect(status().isOk());
        verifyNoInteractions(kakao);
    }
    @Test void unlinkAuthenticatesSenderRevokesSessionsAndKeepsMembershipRecords() throws Exception {
        var user = account("unlink@example.invalid", "9007", true);
        var record = records.saveAndFlush(TtsRecord.builder().teacher(user).infoYear(2026).weekNum(42).isSubmitted(true).build());
        var handoff = authorize(null, "9007", false);
        String oldAccess = access(user);
        http.perform(post("/api/auth/kakao/unlink").param("app_id", "1606088").param("user_id", "9007"))
            .andExpect(status().isUnauthorized());
        http.perform(post("/api/auth/kakao/unlink").header("Authorization", "KakaoAK synthetic-admin").param("app_id", "other-app").param("user_id", "9007"))
            .andExpect(status().isUnauthorized());
        assertNotNull(users.findById(user.getId()).orElseThrow().getKakaoId());
        http.perform(post("/api/auth/kakao/unlink").header("Authorization", "KakaoAK synthetic-admin").param("app_id", "1606088").param("user_id", "9007"))
            .andExpect(status().isOk());
        var saved = users.findById(user.getId()).orElseThrow();
        assertNull(saved.getKakaoId()); assertTrue(saved.isActive()); assertEquals(user.getAuthVersion()+1, saved.getAuthVersion());
        assertTrue(records.existsById(record.getId())); assertFalse(flows.existsById(handoff.flowId()));
        http.perform(get("/api/users/me/kakao").header("Authorization", oldAccess)).andExpect(status().isUnauthorized());
        http.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new LoginRequest(saved.getEmail(), PASSWORD)))).andExpect(status().isOk());
        // Repeated notifications and unknown provider users are acknowledged without changing another account.
        http.perform(get("/api/auth/kakao/unlink").header("Authorization", "KakaoAK synthetic-admin").param("app_id", "1606088").param("user_id", "9007"))
            .andExpect(status().isOk());
        assertEquals(saved.getAuthVersion(), users.findById(user.getId()).orElseThrow().getAuthVersion());
    }
    @Test void oversizedUtf8PasswordIsRejectedWithoutCreatingAnAccount() throws Exception {
        var proof = authorize(null, "9008", false);
        var registration = complete(proof, null, 200);
        var request = registrationRequest(proof, registration, "long-password@example.invalid");
        request.setPassword("한".repeat(25));
        http.perform(post("/api/auth/kakao/register").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request))).andExpect(status().isBadRequest());
        assertEquals(0, users.count());
        assertTrue(flows.existsById(proof.flowId()));
    }
    KakaoRegisterRequest registrationRequest(KakaoCompleteRequest proof, JsonNode registration, String email) {
        var request = new KakaoRegisterRequest(); request.setFlowId(proof.flowId()); request.setTicket(registration.path("ticket").asText()); request.setVerifier(VERIFIER);
        request.setName("신규 검수 교사"); request.setEmail(email); request.setPassword(PASSWORD); return request;
    }
}
