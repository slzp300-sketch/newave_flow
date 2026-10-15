package com.newaveflow;

import com.fasterxml.jackson.databind.*;
import com.newaveflow.config.AppleProperties;
import com.newaveflow.dto.auth.*;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"apple.enabled=false", "spring.datasource.url=jdbc:h2:mem:apple_auth_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1"})
@ActiveProfiles("test") @AutoConfigureMockMvc @DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class AppleAuthTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired AppleAccountRepository accounts;
    @Autowired AppleAuthFlowRepository flows;
    @Autowired AccountDeletionRequestRepository deletions;
    @Autowired TtsRecordRepository records;
    @Autowired JwtTokenProvider tokens;
    @Autowired PasswordEncoder encoder;
    @Autowired AppleProperties config;
    @Autowired AppleTokenCipher cipher;
    @Autowired AppleAuthService service;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    @MockBean AppleClient apple;
    static final String PASSWORD = "Synthetic!2026";
    static final String VERIFIER = "v".repeat(43);

    @BeforeEach void reset() {
        deletions.deleteAllInBatch(); flows.deleteAllInBatch(); accounts.deleteAllInBatch(); records.deleteAllInBatch(); users.deleteAllInBatch();
        config.setEnabled(true); config.setClientId("app.example.synthetic");
        byte[] key = new byte[32]; new SecureRandom().nextBytes(key); config.setTokenEncryptionKey(Base64.getEncoder().encodeToString(key));
        org.mockito.Mockito.reset(apple);
    }
    User account(String email, String subject, boolean active) {
        return new org.springframework.transaction.support.TransactionTemplate(transactions).execute(status -> {
            var user = users.saveAndFlush(User.builder().name("가상 Apple 교사").email(email).password(encoder.encode(PASSWORD)).role(User.Role.TEACHER).isActive(active).build());
            if (subject != null) accounts.saveAndFlush(AppleAccount.builder().user(user).subject(subject).refreshTokenCiphertext(cipher.encrypt("synthetic-refresh", subject)).build());
            return user;
        });
    }
    String access(User user) { return "Bearer " + tokens.createAccessToken(user.getId(), user.getEmail(), user.getRole().name(), user.getAuthVersion()); }
    AppleCompleteRequest start(User user, String subject) throws Exception {
        String path = user == null ? "/api/auth/apple/start" : "/api/users/me/apple/start";
        var call = post(path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new AppleStartRequest(AppleAuthService.challenge(VERIFIER), "ios", user == null ? null : PASSWORD)));
        if (user != null) call.header("Authorization", access(user));
        var result = json.readTree(http.perform(call).andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store")).andReturn().getResponse().getContentAsString());
        String id = result.path("flowId").asText();
        assertEquals(43, result.path("nonce").asText().length()); assertEquals(43, result.path("state").asText().length());
        assertNotEquals(result.path("nonce").asText(), flows.findById(id).orElseThrow().getNonceHash());
        when(apple.identify(eq("synthetic-identity"), eq("synthetic-code"), anyString())).thenReturn(new AppleClient.Credential(subject, "synthetic-refresh"));
        when(apple.verifiedSubject(eq("synthetic-identity"), anyString())).thenReturn(subject);
        return new AppleCompleteRequest(id, result.path("state").asText(), VERIFIER, "synthetic-identity", "synthetic-code");
    }
    JsonNode complete(AppleCompleteRequest proof, User user, int statusCode) throws Exception {
        var call = post("/api/auth/apple/complete").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(proof));
        if (user != null) call.header("Authorization", access(user));
        return json.readTree(http.perform(call).andExpect(status().is(statusCode)).andReturn().getResponse().getContentAsString());
    }
    AppleRegisterRequest registration(AppleCompleteRequest proof, JsonNode result, String email) {
        var request = new AppleRegisterRequest(); request.setFlowId(proof.flowId()); request.setTicket(result.path("ticket").asText()); request.setVerifier(VERIFIER);
        request.setName("가상 신규 교사"); request.setEmail(email); request.setPassword(PASSWORD); return request;
    }
    void register(AppleRegisterRequest request, int statusCode) throws Exception {
        http.perform(post("/api/auth/apple/register").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request))).andExpect(status().is(statusCode));
    }
    @Test void existingConnectionKeepsAccountAndRequiresSingleUseOriginalDeviceProof() throws Exception {
        var owner = account("owner@example.invalid", null, true);
        var record = records.saveAndFlush(TtsRecord.builder().teacher(owner).infoYear(2026).weekNum(42).isSubmitted(true).build());
        var proof = start(owner, "subject1");
        complete(new AppleCompleteRequest(proof.flowId(), proof.state(), "x".repeat(43), proof.identityToken(), proof.authorizationCode()), owner, 400);
        complete(new AppleCompleteRequest(proof.flowId(), "x".repeat(43), proof.verifier(), proof.identityToken(), proof.authorizationCode()), owner, 400);
        verifyNoInteractions(apple);
        assertEquals("LINKED", complete(proof, owner, 200).path("status").asText());
        var account = accounts.findById(owner.getId()).orElseThrow();
        assertEquals("subject1", account.getSubject()); assertFalse(account.getRefreshTokenCiphertext().contains("synthetic-refresh"));
        assertEquals("synthetic-refresh", cipher.decrypt(account.getRefreshTokenCiphertext(), "subject1"));
        assertEquals(owner.getId(), records.findById(record.getId()).orElseThrow().getTeacher().getId());
        assertEquals(owner.getPassword(), users.findById(owner.getId()).orElseThrow().getPassword());
        complete(proof, owner, 400);
        var signed = complete(start(null, "subject1"), null, 200);
        assertEquals("SIGNED_IN", signed.path("status").asText()); assertEquals(owner.getId(), signed.path("session").path("user").path("id").asLong());
        assertEquals("subject1", signed.path("appleSubject").asText());
        http.perform(get("/api/users/me/apple").header("Authorization", access(owner))).andExpect(status().isOk()).andExpect(jsonPath("$.connected").value(true));
    }
    @Test void newSignupNeverBypassesApprovalAndEmailIsNeverAutomaticallyMerged() throws Exception {
        var original = account("same@example.invalid", null, true);
        var proof = start(null, "new-subject"); var result = complete(proof, null, 200);
        assertEquals("REGISTRATION_REQUIRED", result.path("status").asText()); assertFalse(result.has("session"));
        register(registration(proof, result, original.getEmail()), 409);
        assertFalse(accounts.existsById(original.getId())); assertEquals(1, users.count());
        var request = registration(proof, result, "new@example.invalid"); register(request, 201);
        var created = users.findByEmailIgnoreCase("new@example.invalid").orElseThrow();
        assertFalse(created.isActive()); assertEquals(User.Role.TEACHER, created.getRole());
        complete(start(null, "new-subject"), null, 401);
        http.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new LoginRequest(created.getEmail(), PASSWORD)))).andExpect(status().isUnauthorized());
        created.approve(); users.saveAndFlush(created);
        assertEquals("SIGNED_IN", complete(start(null, "new-subject"), null, 200).path("status").asText());
        register(request, 400);
    }
    @Test void linkRequiresPasswordSameActorAndUnchangedSession() throws Exception {
        User owner = account("link@example.invalid", null, true), other = account("other@example.invalid", null, true);
        http.perform(post("/api/users/me/apple/start").header("Authorization", access(owner)).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(new AppleStartRequest(AppleAuthService.challenge(VERIFIER), "ios", "wrong")))).andExpect(status().isBadRequest());
        var proof = start(owner, "subject2");
        complete(proof, other, 403); complete(proof, null, 403);
        owner.revokeSessions(); users.saveAndFlush(owner);
        complete(proof, owner, 401); assertEquals(0, accounts.count()); verifyNoInteractions(apple);
    }
    @Test void existingSubjectCannotBeMovedToAnotherAccount() throws Exception {
        User original = account("first@example.invalid", "owned-subject", true), other = account("second@example.invalid", null, true);
        complete(start(other, "owned-subject"), other, 409);
        assertEquals(original.getId(), accounts.findUserIdBySubject("owned-subject").orElseThrow());
    }
    @Test void unsupportedPlatformExpiredFlowAndMissingCodeAreRejected() throws Exception {
        for (String platform : List.of("web", "android", "ios-attacker")) {
            http.perform(post("/api/auth/apple/start").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new AppleStartRequest(AppleAuthService.challenge(VERIFIER), platform, null)))).andExpect(status().isBadRequest());
        }
        var proof = start(null, "subject3");
        complete(new AppleCompleteRequest(proof.flowId(), proof.state(), proof.verifier(), proof.identityToken(), ""), null, 400);
        var flow = flows.findById(proof.flowId()).orElseThrow(); flow.setExpiresAt(Instant.now().minusSeconds(1)); flows.saveAndFlush(flow);
        complete(proof, null, 400); verifyNoInteractions(apple);
    }
    @Test void disabledFeatureReturnsOnlyFlagAndPreservesPasswordLogin() throws Exception {
        var owner = account("fallback@example.invalid", null, true); config.setEnabled(false);
        String response = http.perform(get("/api/auth/apple/config")).andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(false)).andReturn().getResponse().getContentAsString();
        assertEquals("{\"enabled\":false}", response);
        http.perform(post("/api/auth/apple/start").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(new AppleStartRequest(AppleAuthService.challenge(VERIFIER), "ios", null)))).andExpect(status().isBadRequest());
        http.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new LoginRequest(owner.getEmail(), PASSWORD)))).andExpect(status().isOk());
        verifyNoInteractions(apple);
    }
    @Test void deletionRevokesAppleBeforeClearingTokenAndCannotBeReversedByPendingFlow() throws Exception {
        var owner = account("delete@example.invalid", "delete-subject", true);
        var proof = start(null, "delete-subject"); String oldAccess = access(owner);
        doThrow(AppException.badRequest("synthetic provider failure")).when(apple).revoke("synthetic-refresh");
        assertThrows(AppException.class, () -> service.revokeForDeletion(owner.getId()));
        assertNull(accounts.findById(owner.getId()).orElseThrow().getRevokedAt());
        assertNotNull(accounts.findById(owner.getId()).orElseThrow().getRefreshTokenCiphertext());
        doNothing().when(apple).revoke("synthetic-refresh");
        service.revokeForDeletion(owner.getId()); service.revokeForDeletion(owner.getId());
        var saved = accounts.findById(owner.getId()).orElseThrow(); assertNotNull(saved.getRevokedAt()); assertNull(saved.getRefreshTokenCiphertext());
        verify(apple, times(2)).revoke("synthetic-refresh"); // Failed first attempt + one successful revoke; retry is local.
        complete(proof, null, 403);
        verify(apple, never()).identify(anyString(), anyString(), anyString());
        http.perform(get("/api/users/me/apple").header("Authorization", oldAccess)).andExpect(status().isUnauthorized());
        http.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new LoginRequest(owner.getEmail(), PASSWORD)))).andExpect(status().isOk());
    }
    @Test void pendingDeletionPreventsNewAppleLinkEvenWhenNoAppleAccountExists() throws Exception {
        var owner = account("pending@example.invalid", null, true);
        var proof = start(owner, "pending-subject");
        deletions.saveAndFlush(AccountDeletionRequest.builder().id(UUID.randomUUID().toString()).user(owner).userCreatedAt(owner.getCreatedAt())
            .receiptTokenHash("f".repeat(64)).status(AccountDeletionRequest.Status.REQUESTED).requestedAt(Instant.now()).targetAt(Instant.now().plusSeconds(604800)).build());
        complete(proof, owner, 403);
        http.perform(post("/api/users/me/apple/start").header("Authorization", access(owner)).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(new AppleStartRequest(AppleAuthService.challenge(VERIFIER), "ios", PASSWORD)))).andExpect(status().isForbidden());
        assertEquals(0, accounts.count()); verifyNoInteractions(apple);
    }
    @Test void registrationRejectsOversizedPasswordAndReviewAddress() throws Exception {
        var proof = start(null, "signup-subject"); var result = complete(proof, null, 200);
        var request = registration(proof, result, "signup@example.invalid"); request.setPassword("한".repeat(25)); register(request, 400);
        request.setPassword(PASSWORD); request.setEmail("synthetic@review.newaveflow.invalid"); register(request, 400);
        assertEquals(0, users.count()); assertEquals(0, accounts.count());
    }
}
