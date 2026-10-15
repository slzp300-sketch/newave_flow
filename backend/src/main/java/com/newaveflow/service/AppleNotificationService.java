package com.newaveflow.service;

import com.newaveflow.config.AppleProperties;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.AppleAccountRepository;
import com.newaveflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;

@Service @RequiredArgsConstructor
public class AppleNotificationService {
    private final AppleProperties config;
    private final AppleNotificationVerifier verifier;
    private final AppleNotificationStateStore states;
    private final AppleAccountRepository accounts;
    private final UserRepository users;

    @Transactional
    public void receive(String payload) {
        if (!config.isNotificationsEnabled()) throw new AppException(HttpStatus.NOT_FOUND, "사용할 수 없는 주소입니다.");
        var event = verifier.verify(payload);
        var state = states.lock(event.subject());
        if (!states.record(state, event)) return;
        Long userId = accounts.findUserIdBySubject(event.subject()).orElse(null);
        states.revoke(state, event, userId);
        // This app sends no Apple relay emails. Their delivery IDs are checked, but they cannot change email or access.
        if (!event.revokesAccess()) return;
        if (userId == null) return; // Durable watermark also protects a registration that has not committed yet.
        var user = users.lockById(userId).orElse(null);
        if (user == null) return;
        var account = accounts.lockByUserId(userId).orElse(null);
        if (account == null || !event.subject().equals(account.getSubject()) || account.getRevokedAt() != null) return;
        if (event.type().equals("consent-revoked") && state.grantStartedAt() != null && event.eventTime() < state.grantStartedAt()) return;
        account.setRefreshTokenCiphertext(null);
        account.setRevokedAt(Instant.now());
        user.revokeSessions();
        // Do not delete users/records or create an app-account deletion request. Never lock flows after subject/user locks.
    }
}
