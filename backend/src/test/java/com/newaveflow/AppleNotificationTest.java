package com.newaveflow;

import com.fasterxml.jackson.databind.*;
import com.newaveflow.config.AppleProperties;
import com.newaveflow.dto.auth.*;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.*;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.*;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.security.*;
import java.security.interfaces.RSAPublicKey;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"apple.enabled=false", "apple.notifications-enabled=false", "spring.datasource.url=jdbc:h2:mem:apple_notification_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000"})
@ActiveProfiles("test") @AutoConfigureMockMvc @DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class AppleNotificationTest {
    static KeyPair rsa;
    static final String PASSWORD="Synthetic!2026", VERIFIER="v".repeat(43), CLIENT="app.synthetic.notifications";
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired AppleAccountRepository accounts;
    @Autowired AppleAuthFlowRepository flows;
    @Autowired AccountDeletionRequestRepository deletions;
    @Autowired TtsRecordRepository records;
    @Autowired JwtTokenProvider tokens;
    @Autowired PasswordEncoder passwords;
    @Autowired AppleProperties config;
    @Autowired AppleAuthService auth;
    @Autowired AppleNotificationService notifications;
    @Autowired PlatformTransactionManager tx;
    @Autowired JdbcTemplate db;
    @SpyBean AppleNotificationStateStore states;
    @MockBean ApplePublicKeys keys;
    @MockBean AppleClient apple;
    @BeforeAll static void key() throws Exception { var g=KeyPairGenerator.getInstance("RSA"); g.initialize(2048); rsa=g.generateKeyPair(); }
    @BeforeEach void setup() {
        config.setNotificationsEnabled(false);
        db.execute("CREATE TABLE IF NOT EXISTS apple_notification_subjects(subject_hash varchar(64) PRIMARY KEY,user_id bigint REFERENCES users(id) ON DELETE CASCADE,consent_revoked_at bigint,account_deleted_at bigint,grant_started_at bigint,updated_at timestamp with time zone NOT NULL)");
        db.execute("CREATE TABLE IF NOT EXISTS apple_notification_receipts(jti_hash varchar(64) PRIMARY KEY,subject_hash varchar(64) NOT NULL REFERENCES apple_notification_subjects(subject_hash) ON DELETE CASCADE,payload_hash varchar(64) NOT NULL,received_at timestamp with time zone NOT NULL)");
        db.update("DELETE FROM apple_notification_receipts"); db.update("DELETE FROM apple_notification_subjects");
        deletions.deleteAllInBatch(); flows.deleteAllInBatch(); accounts.deleteAllInBatch(); records.deleteAllInBatch(); users.deleteAllInBatch();
        reset(apple, keys, states);
        when(keys.resolve("synthetic")).thenReturn((RSAPublicKey)rsa.getPublic());
        config.setEnabled(true); config.setNotificationsEnabled(true); config.setClientId(CLIENT);
        byte[] key=new byte[32]; new SecureRandom().nextBytes(key); config.setTokenEncryptionKey(Base64.getEncoder().encodeToString(key));
    }
    String notification(String id,String type,String subject,long time) {
        return Jwts.builder().header().keyId("synthetic").and().issuer("https://appleid.apple.com").audience().add(CLIENT).and()
            .issuedAt(new Date()).id(id).claim("events",Map.of("type",type,"sub",subject,"event_time",time)).signWith(rsa.getPrivate(),Jwts.SIG.RS256).compact();
    }
    long now() { return Instant.now().getEpochSecond(); }
    User owner(String subject) {
        return new TransactionTemplate(tx).execute(status -> {
            var user=users.saveAndFlush(User.builder().name("Synthetic notification teacher").email(UUID.randomUUID()+"@example.invalid").password(passwords.encode(PASSWORD)).role(User.Role.TEACHER).isActive(true).build());
            if(subject!=null) {
                var state=states.lock(subject);
                accounts.saveAndFlush(AppleAccount.builder().user(user).subject(subject).refreshTokenCiphertext("synthetic-protected-token").build());
                states.grant(state,user.getId(),now()-100);
            }
            return user;
        });
    }
    String access(User user) { return "Bearer "+tokens.createAccessToken(user.getId(),user.getEmail(),user.getRole().name(),user.getAuthVersion()); }
    void deliver(String token,int expected) throws Exception {
        var request=http.perform(post("/api/auth/apple/notifications").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("payload",token)))).andExpect(status().is(expected));
        if(expected==200) request.andExpect(header().string("Cache-Control","no-store")).andExpect(content().string(""));
    }
    AppleCompleteRequest start(User owner,String subject) {
        var result=auth.start(new AppleStartRequest(AppleAuthService.challenge(VERIFIER),"ios",owner==null?null:PASSWORD),owner,owner==null?AppleAuthFlow.Purpose.LOGIN:AppleAuthFlow.Purpose.LINK);
        when(apple.verifiedSubject(eq("synthetic-id"),anyString())).thenReturn(subject);
        when(apple.identify(eq("synthetic-id"),eq("synthetic-code"),anyString())).thenReturn(new AppleClient.Credential(subject,"synthetic-refresh"));
        return new AppleCompleteRequest(result.get("flowId"),result.get("state"),VERIFIER,"synthetic-id","synthetic-code");
    }
    AppleRegisterRequest pending(String subject) {
        var proof=start(null,subject); var result=auth.complete(proof,null);
        var r=new AppleRegisterRequest(); r.setFlowId(proof.flowId()); r.setVerifier(VERIFIER); r.setTicket((String)result.get("ticket"));
        r.setName("Synthetic pending"); r.setEmail(UUID.randomUUID()+"@example.invalid"); r.setPassword(PASSWORD); return r;
    }
    @Test void authenticRevocationInvalidatesSessionsWithoutDeletingApplicationData() throws Exception {
        var user=owner("subject1"); var record=records.saveAndFlush(TtsRecord.builder().teacher(user).infoYear(2026).weekNum(42).isSubmitted(true).build());
        String originalPassword=user.getPassword(), oldAccess=access(user);
        deliver(notification("event1","consent-revoked","subject1",now()-10),200);
        var account=accounts.findById(user.getId()).orElseThrow(); assertNotNull(account.getRevokedAt()); assertNull(account.getRefreshTokenCiphertext());
        var saved=users.findById(user.getId()).orElseThrow(); assertEquals(user.getAuthVersion()+1,saved.getAuthVersion()); assertEquals(originalPassword,saved.getPassword()); assertTrue(saved.isActive());
        assertTrue(records.existsById(record.getId())); assertEquals(0,deletions.count()); verifyNoInteractions(apple);
        http.perform(get("/api/users/me/apple").header("Authorization",oldAccess)).andExpect(status().isUnauthorized());
        http.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new LoginRequest(saved.getEmail(),PASSWORD)))).andExpect(status().isOk());
    }
    @Test void duplicateJtiIsAtomicAndConflictingContentsAreRejected() throws Exception {
        var user=owner("subject2"); String token=notification("same-jti","consent-revoked","subject2",now()-10);
        deliver(token,200); deliver(token,200);
        assertEquals(1L,users.findById(user.getId()).orElseThrow().getAuthVersion());
        deliver(notification("same-jti","account-deleted","subject2",now()-9),400);
        deliver(notification("same-jti","email-enabled","subject2",now()-9),400);
        assertNull(states.find("subject2").deletedAt()); assertEquals(1,db.queryForObject("SELECT count(*) FROM apple_notification_receipts",Integer.class));
    }
    @Test void passwordAndFreshConsentReconnectWhileLateAndOutOfOrderEventsCannotUndoIt() throws Exception {
        var user=owner("reconnect-subject"); long time=now()-10;
        String old=notification("old","consent-revoked","reconnect-subject",time); deliver(old,200);
        user=users.findById(user.getId()).orElseThrow();
        var fresh=start(user,"reconnect-subject"); assertEquals("LINKED",auth.complete(fresh,user).get("status"));
        assertNull(accounts.findById(user.getId()).orElseThrow().getRevokedAt());
        deliver(old,200); deliver(notification("old-again","consent-revoked","reconnect-subject",time),200);
        deliver(notification("older","consent-revoked","reconnect-subject",time-100),200);
        deliver(notification("email","email-enabled","reconnect-subject",now()),200);
        assertNull(accounts.findById(user.getId()).orElseThrow().getRevokedAt()); assertEquals(1L,users.findById(user.getId()).orElseThrow().getAuthVersion());
        assertEquals(time,states.find("reconnect-subject").revokedAt());
    }
    @Test void sameSecondRevocationRejectsAnOutstandingGrantBeforeCodeExchange() throws Exception {
        var user=owner(null); var proof=start(user,"boundary-subject");
        long started=flows.findById(proof.flowId()).orElseThrow().getExpiresAt().minusSeconds(300).getEpochSecond();
        deliver(notification("boundary","consent-revoked","boundary-subject",started),200);
        assertThrows(AppException.class,()->auth.complete(proof,user)); verify(apple,never()).identify(anyString(),anyString(),anyString()); assertFalse(accounts.existsById(user.getId()));
    }
    @Test void unknownSubjectRevocationPreventsAnAlreadyIssuedSignupAndAppleDeletionRemainsTerminal() throws Exception {
        var request=pending("pending-subject"); deliver(notification("pending","consent-revoked","pending-subject",now()),200);
        assertThrows(AppException.class,()->auth.register(request)); assertEquals(0,users.count());
        deliver(notification("deleted","account-deleted","deleted-subject",now()-10),200);
        assertThrows(AppException.class,()->auth.complete(start(null,"deleted-subject"),null)); assertEquals(0,users.count());
        assertEquals(0,deletions.count());
    }
    @Test void pendingApplicationDeletionStillPreventsReconnection() throws Exception {
        var user=owner("deleting-subject"); deliver(notification("external","consent-revoked","deleting-subject",now()-10),200);
        user=users.findById(user.getId()).orElseThrow();
        deletions.saveAndFlush(AccountDeletionRequest.builder().id(UUID.randomUUID().toString()).user(user).userCreatedAt(user.getCreatedAt()).receiptTokenHash("a".repeat(64)).status(AccountDeletionRequest.Status.REQUESTED).requestedAt(Instant.now()).targetAt(Instant.now().plusSeconds(604800)).build());
        User finalUser=user; assertThrows(AppException.class,()->start(finalUser,"deleting-subject"));
        assertEquals(1,deletions.count()); assertEquals(1,users.count());
    }
    @Test void notificationOnlyModeWorksAndDisabledModeDoesNotTouchOptionalTables() throws Exception {
        var user=owner("paused-subject"); config.setEnabled(false);
        deliver(notification("paused","consent-revoked","paused-subject",now()-10),200); assertNotNull(accounts.findById(user.getId()).orElseThrow().getRevokedAt());
        config.setNotificationsEnabled(false); clearInvocations(keys,states);
        deliver(notification("disabled","account-deleted","paused-subject",now()),404); verifyNoInteractions(keys,states);
        db.execute("DROP TABLE apple_notification_receipts"); db.execute("DROP TABLE apple_notification_subjects");
        assertDoesNotThrow(()->states.run(null)); assertDoesNotThrow(states::cleanup);
        config.setNotificationsEnabled(true); assertThrows(IllegalStateException.class,()->states.run(null));
    }
    @Test void expiredReceiptsAndUnownedStatesAreRemovedButConnectedStateRemains() throws Exception {
        var user=owner("retained-subject"); deliver(notification("retained","consent-revoked","retained-subject",now()-10),200);
        deliver(notification("unknown","consent-revoked","unknown-subject",now()-10),200);
        Timestamp old=Timestamp.from(Instant.now().minusSeconds(31L*86400));
        db.update("UPDATE apple_notification_receipts SET received_at=?",old); db.update("UPDATE apple_notification_subjects SET updated_at=?",old);
        states.cleanup(); assertEquals(0,db.queryForObject("SELECT count(*) FROM apple_notification_receipts",Integer.class));
        assertNotNull(states.find("retained-subject")); assertNull(states.find("unknown-subject"));
        new TransactionTemplate(tx).executeWithoutResult(s->users.deleteById(user.getId())); assertNull(states.find("retained-subject"));
    }
    @Test void concurrentRegistrationAndRevocationSerializeInBothOrders() throws Exception {
        for(boolean registrationFirst:List.of(false,true)) {
            String subject="race-"+registrationFirst;
            var request=pending(subject); String event=notification("race-event-"+registrationFirst,"consent-revoked",subject,now());
            var firstLocked=new CountDownLatch(1); var release=new CountDownLatch(1); var secondAttempted=new CountDownLatch(1);
            doAnswer(call->{
                if(Thread.currentThread().getName().equals("second-apple-operation")) secondAttempted.countDown();
                var result=call.callRealMethod();
                if(Thread.currentThread().getName().equals("first-apple-operation")) { firstLocked.countDown(); if(!release.await(5,TimeUnit.SECONDS)) throw new IllegalStateException("Synthetic concurrency timeout"); }
                return result;
            }).when(states).lock(subject);
            var pool=Executors.newFixedThreadPool(2);
            try {
                var first=pool.submit(()->{Thread.currentThread().setName("first-apple-operation"); if(registrationFirst)auth.register(request);else notifications.receive(event);});
                assertTrue(firstLocked.await(5,TimeUnit.SECONDS));
                var second=pool.submit(()->{Thread.currentThread().setName("second-apple-operation"); if(registrationFirst)notifications.receive(event);else assertThrows(AppException.class,()->auth.register(request));});
                assertTrue(secondAttempted.await(5,TimeUnit.SECONDS)); release.countDown(); first.get(10,TimeUnit.SECONDS); second.get(10,TimeUnit.SECONDS);
                if(registrationFirst) { var user=users.findByEmailIgnoreCase(request.getEmail()).orElseThrow(); assertNotNull(accounts.findById(user.getId()).orElseThrow().getRevokedAt()); assertEquals(1,user.getAuthVersion()); }
                else assertFalse(users.existsByEmailIgnoreCase(request.getEmail()));
            } finally { release.countDown(); pool.shutdownNow(); doCallRealMethod().when(states).lock(subject); }
        }
    }
}
