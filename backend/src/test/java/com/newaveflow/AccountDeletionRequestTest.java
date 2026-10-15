package com.newaveflow;

import com.fasterxml.jackson.databind.*;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:account_deletion_request_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@ActiveProfiles("test") @AutoConfigureMockMvc @DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AccountDeletionRequestTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired AccountDeletionRequestRepository requests;
    @Autowired TtsRecordRepository records;
    @Autowired PasswordEncoder passwords;
    @Autowired JwtTokenProvider tokens;
    @Autowired AuthService auth;
    @Autowired AccountDeletionService deletion;
    @Autowired JdbcTemplate jdbc;
    @MockBean AppleAuthService apple;
    private static final String PASSWORD = "Synthetic-delete!2026";

    @BeforeEach void resetData() {
        requests.deleteAllInBatch(); records.deleteAllInBatch(); users.deleteAllInBatch(); reset(apple);
    }
    User user(String email, User.Role role) {
        return users.saveAndFlush(User.builder().name("가상 삭제 교사").email(email).password(passwords.encode(PASSWORD)).role(role).isActive(true).build());
    }
    String access(User user) {
        User current = users.findById(user.getId()).orElseThrow();
        return "Bearer " + tokens.createAccessToken(current.getId(), current.getEmail(), current.getRole().name(), current.getAuthVersion());
    }
    JsonNode submit(User user) throws Exception {
        return json.readTree(http.perform(post("/api/account-deletion").header("Authorization", access(user)).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("password", PASSWORD, "confirmed", true))))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store")).andReturn().getResponse().getContentAsString());
    }
    JsonNode statusOf(String token, int expected) throws Exception {
        return json.readTree(http.perform(post("/api/auth/account-deletion/status").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("receiptToken", token))))
            .andExpect(status().is(expected)).andReturn().getResponse().getContentAsString());
    }
    @Test void submissionRequiresAuthenticatedOwnerPasswordAndExplicitConfirmation() throws Exception {
        User user = user("confirm@example.invalid", User.Role.TEACHER);
        http.perform(post("/api/account-deletion").contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"x\",\"confirmed\":true}")).andExpect(status().isUnauthorized());
        http.perform(get("/api/account-deletion")).andExpect(status().isUnauthorized());
        for (var input : List.of(Map.of("password", "wrong", "confirmed", true), Map.of("password", PASSWORD, "confirmed", false))) {
            http.perform(post("/api/account-deletion").header("Authorization", access(user)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(input))).andExpect(status().isBadRequest());
        }
        assertEquals(0, requests.count()); verifyNoInteractions(apple);
    }
    @Test void receiptIsPrivateAndRequestDoesNotEraseOrExposeAnotherAccount() throws Exception {
        User owner = user("owner@example.invalid", User.Role.TEACHER), other = user("other@example.invalid", User.Role.TEACHER);
        records.saveAndFlush(TtsRecord.builder().teacher(owner).infoYear(2026).weekNum(42).isSubmitted(true).build());
        JsonNode received = submit(owner);
        String token = received.path("receiptToken").asText(); assertEquals(43, token.length());
        var stored = requests.findByUserId(owner.getId()).orElseThrow();
        assertNotEquals(token, stored.getReceiptTokenHash()); assertEquals(64, stored.getReceiptTokenHash().length());
        assertEquals(2, users.count()); assertEquals(1, records.count());
        assertEquals(7, ChronoUnit.DAYS.between(stored.getRequestedAt(), stored.getTargetAt()));
        verify(apple).revokeForDeletion(owner.getId());
        String publicReceipt = statusOf(token, 200).toString();
        assertTrue(publicReceipt.contains("REQUESTED"));
        for (String privateField : List.of(owner.getEmail(), owner.getName(), "userId", "receiptToken", "password")) assertFalse(publicReceipt.contains(privateField));
        http.perform(get("/api/account-deletion").header("Authorization", access(other)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("NONE"));
        statusOf("x".repeat(43), 404);
        http.perform(get("/api/account-deletion").header("Authorization", access(owner)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.requestId").value(stored.getId()));
    }
    @Test void authenticatedRetryKeepsOneRequestAndRenewsOnlyReceiptCapability() throws Exception {
        User owner = user("retry@example.invalid", User.Role.TEACHER);
        JsonNode first = submit(owner), second = submit(owner);
        assertEquals(1, requests.count()); assertEquals(first.path("requestId"), second.path("requestId"));
        assertEquals(first.path("requestedAt"), second.path("requestedAt")); assertEquals(first.path("targetAt"), second.path("targetAt"));
        assertNotEquals(first.path("receiptToken"), second.path("receiptToken"));
        statusOf(first.path("receiptToken").asText(), 404); statusOf(second.path("receiptToken").asText(), 200);
    }
    @Test void lastAdministratorCanRequestButIsInformedThatHandoverIsRequired() throws Exception {
        User admin = user("admin@example.invalid", User.Role.ADMIN);
        JsonNode receipt = submit(admin);
        assertTrue(receipt.path("handoverRequired").asBoolean()); assertTrue(receipt.path("message").asText().contains("권한 인계"));
        assertTrue(users.findById(admin.getId()).orElseThrow().isActive());
    }
    @Test void providerRevocationFailureNeverAcknowledgesDeletion() throws Exception {
        User owner = user("provider@example.invalid", User.Role.TEACHER);
        doThrow(AppException.conflict("가상 제공자 장애")).when(apple).revokeForDeletion(owner.getId());
        http.perform(post("/api/account-deletion").header("Authorization", access(owner)).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("password", PASSWORD, "confirmed", true)))).andExpect(status().isConflict());
        assertEquals(0, requests.count()); assertTrue(users.findById(owner.getId()).isPresent());
    }
    @Test void acknowledgedRequestRevokesOldSessionsWhilePasswordSignInRemainsAvailable() throws Exception {
        User owner = user("session@example.invalid", User.Role.TEACHER);
        String oldAccess = access(owner), oldRefresh = tokens.createRefreshToken(owner.getId(), owner.getEmail(), owner.getRole().name(), owner.getAuthVersion());
        JsonNode receipt = submit(owner);
        http.perform(get("/api/users/me").header("Authorization", oldAccess)).andExpect(status().isUnauthorized());
        assertThrows(AppException.class, () -> auth.refresh(oldRefresh));
        http.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("email", owner.getEmail(), "password", PASSWORD)))).andExpect(status().isOk());
        statusOf(receipt.path("receiptToken").asText(), 200);
    }
    @Test void completedAnonymousReceiptRemainsReadableAfterActualAccountAndSessionsAreGone() throws Exception {
        User owner = user("complete@example.invalid", User.Role.TEACHER);
        String access = access(owner), refresh = tokens.createRefreshToken(owner.getId(), owner.getEmail(), owner.getRole().name(), owner.getAuthVersion());
        JsonNode receipt = submit(owner);
        // The separate PostgreSQL privacy test exercises the actual reviewed deletion SQL.
        jdbc.update("UPDATE account_deletion_requests SET user_id=NULL,user_created_at=NULL,status='COMPLETED',completed_at=CURRENT_TIMESTAMP WHERE id=?", receipt.path("requestId").asText());
        users.deleteById(owner.getId());
        http.perform(get("/api/users/me").header("Authorization", access)).andExpect(status().isUnauthorized());
        assertThrows(AppException.class, () -> auth.refresh(refresh));
        JsonNode result = statusOf(receipt.path("receiptToken").asText(), 200);
        assertEquals("COMPLETED", result.path("status").asText()); assertFalse(result.path("completedAt").isNull());
        var saved = requests.findById(receipt.path("requestId").asText()).orElseThrow();
        assertNull(saved.getUser()); assertNull(saved.getUserCreatedAt());
    }
    @Test void retentionPurgesOnlyCompletedReceiptsAndNeverPendingRequests() throws Exception {
        User old = user("old@example.invalid", User.Role.TEACHER), pending = user("pending@example.invalid", User.Role.TEACHER);
        JsonNode doneReceipt = submit(old), pendingReceipt = submit(pending);
        jdbc.update("UPDATE account_deletion_requests SET user_id=NULL,user_created_at=NULL,status='COMPLETED',completed_at=? WHERE id=?",
            java.sql.Timestamp.from(Instant.now().minus(31, ChronoUnit.DAYS)), doneReceipt.path("requestId").asText());
        jdbc.update("UPDATE account_deletion_requests SET requested_at=? WHERE id=?", java.sql.Timestamp.from(Instant.now().minus(40, ChronoUnit.DAYS)), pendingReceipt.path("requestId").asText());
        statusOf(doneReceipt.path("receiptToken").asText(), 404);
        deletion.cleanupCompletedReceipts();
        assertEquals(1, requests.count()); statusOf(pendingReceipt.path("receiptToken").asText(), 200);
    }
}
