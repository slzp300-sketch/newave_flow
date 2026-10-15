package com.newaveflow.service;

import com.newaveflow.config.AppleProperties;
import com.newaveflow.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

/** Optional JDBC schema: disabled deployments never query or require V011 tables. */
@Component @RequiredArgsConstructor
public class AppleNotificationStateStore implements ApplicationRunner {
    private final AppleProperties config;
    private final JdbcTemplate db;

    public record State(String hash, Long userId, Long revokedAt, Long deletedAt, Long grantStartedAt) {}

    @Override public void run(ApplicationArguments ignored) {
        if (!config.isNotificationsEnabled()) return;
        try {
            if (!"PostgreSQL".equals(db.execute((org.springframework.jdbc.core.ConnectionCallback<String>) c -> c.getMetaData().getDatabaseProductName()))
                    || !Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version='V011__apple_notifications')", Boolean.class))) {
                throw new IllegalStateException();
            }
            db.queryForList("SELECT subject_hash,user_id,consent_revoked_at,account_deleted_at,grant_started_at,updated_at FROM apple_notification_subjects WHERE 1=0");
            db.queryForList("SELECT jti_hash,subject_hash,payload_hash,received_at FROM apple_notification_receipts WHERE 1=0");
        } catch (Exception unavailable) {
            throw new IllegalStateException("Apple notifications require the verified PostgreSQL V011 schema before activation.");
        }
    }

    public String subjectHash(String subject) { return AppleClient.sha256(config.getClientId() + "\u0000" + subject); }
    private String eventHash(String id) { return AppleClient.sha256(config.getClientId() + "\u0000" + id); }
    public State lock(String subject) {
        if (!config.isNotificationsEnabled()) return null;
        if (!TransactionSynchronizationManager.isActualTransactionActive()) throw new IllegalStateException("Apple subject locking requires a transaction.");
        String hash = subjectHash(subject);
        db.update("INSERT INTO apple_notification_subjects(subject_hash,updated_at) VALUES (?,?) ON CONFLICT DO NOTHING", hash, Timestamp.from(Instant.now()));
        return read(hash, true);
    }
    public State find(String subject) { return config.isNotificationsEnabled() ? read(subjectHash(subject), false) : null; }
    private State read(String hash, boolean lock) {
        List<State> rows = db.query("SELECT subject_hash,user_id,consent_revoked_at,account_deleted_at,grant_started_at FROM apple_notification_subjects WHERE subject_hash=?" + (lock ? " FOR UPDATE" : ""),
            (rs, n) -> new State(rs.getString(1), rs.getObject(2, Long.class), rs.getObject(3, Long.class), rs.getObject(4, Long.class), rs.getObject(5, Long.class)), hash);
        return rows.isEmpty() ? null : rows.get(0);
    }
    /** Called while the subject row is locked. Insertion and the account mutation commit together. */
    public boolean record(State state, AppleNotificationVerifier.Event event) {
        String id = eventHash(event.id());
        int added = db.update("INSERT INTO apple_notification_receipts(jti_hash,subject_hash,payload_hash,received_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING",
            id, state.hash(), event.payloadHash(), Timestamp.from(Instant.now()));
        if (added == 1) {
            db.update("UPDATE apple_notification_subjects SET updated_at=? WHERE subject_hash=?", Timestamp.from(Instant.now()), state.hash());
            return true;
        }
        var old = db.queryForMap("SELECT subject_hash,payload_hash FROM apple_notification_receipts WHERE jti_hash=?", id);
        if (!state.hash().equals(old.get("subject_hash")) || !event.payloadHash().equals(old.get("payload_hash"))) throw AppException.badRequest("Apple 알림 식별자가 일치하지 않습니다.");
        return false;
    }
    public void revoke(State state, AppleNotificationVerifier.Event event, Long userId) {
        Long consent = state.revokedAt(), deleted = state.deletedAt();
        if (event.type().equals("consent-revoked")) consent = Math.max(consent == null ? 0 : consent, event.eventTime());
        if (event.type().equals("account-deleted")) deleted = Math.max(deleted == null ? 0 : deleted, event.eventTime());
        if (state.userId() != null && userId != null && !state.userId().equals(userId)) throw new IllegalStateException("Apple subject owner changed unexpectedly.");
        db.update("UPDATE apple_notification_subjects SET user_id=?,consent_revoked_at=?,account_deleted_at=?,updated_at=? WHERE subject_hash=?",
            userId == null ? state.userId() : userId, consent, deleted, Timestamp.from(Instant.now()), state.hash());
    }
    public void requireFreshGrant(State state, long started) {
        if (state == null) return;
        if (state.deletedAt() != null) throw AppException.forbidden("삭제된 Apple 계정은 연결할 수 없습니다. 이메일로 로그인해 주세요.");
        if (state.revokedAt() != null && started <= state.revokedAt()) throw AppException.forbidden("Apple 연결 상태가 변경됐어요. 잠시 후 Apple 인증을 처음부터 다시 진행해 주세요.");
    }
    public void grant(State state, Long userId, long started) {
        if (state == null) return;
        requireFreshGrant(state, started);
        if (state.userId() != null && !state.userId().equals(userId)) throw AppException.conflict("이 Apple 계정은 다른 회원에게 연결되어 있어요.");
        db.update("UPDATE apple_notification_subjects SET user_id=?,grant_started_at=?,updated_at=? WHERE subject_hash=?",
            userId, Math.max(state.grantStartedAt() == null ? 0 : state.grantStartedAt(), started), Timestamp.from(Instant.now()), state.hash());
    }
    public boolean canReconnect(State state) { return state != null && state.revokedAt() != null && state.deletedAt() == null; }

    @Scheduled(fixedDelay = 3600000) @Transactional
    public void cleanup() {
        if (!config.isNotificationsEnabled()) return;
        Timestamp cutoff = Timestamp.from(Instant.now().minusSeconds(30L * 86400));
        db.update("DELETE FROM apple_notification_receipts WHERE received_at < ?", cutoff);
        // A valid registration flow lasts only five minutes. Old unowned states cannot still have a valid grant waiting.
        db.update("DELETE FROM apple_notification_subjects WHERE user_id IS NULL AND updated_at < ?", cutoff);
    }
}
