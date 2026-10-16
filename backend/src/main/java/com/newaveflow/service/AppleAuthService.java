package com.newaveflow.service;

import com.newaveflow.config.AppleProperties;
import com.newaveflow.dto.auth.*;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import static com.newaveflow.entity.AppleAuthFlow.*;

@Service @RequiredArgsConstructor
public class AppleAuthService {
    private final AppleProperties config;
    private final AppleClient apple;
    private final AppleTokenCipher cipher;
    private final AppleAuthFlowRepository flows;
    private final AppleAccountRepository accounts;
    private final AccountDeletionRequestRepository deletions;
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final AuthService auth;
    private final AppleNotificationStateStore notificationStates;
    private static final long FLOW_SECONDS = 300;
    private static final SecureRandom RANDOM = new SecureRandom();

    @Scheduled(fixedDelay = 60000) @Transactional
    public void cleanup() { flows.deleteExpired(Instant.now()); }

    @Transactional(readOnly = true)
    public Map<String, Boolean> status(User user) {
        return Map.of("enabled", config.isEnabled(), "connected", accounts.findById(user.getId()).filter(a -> a.getRevokedAt() == null).isPresent());
    }

    @Transactional
    public Map<String, String> start(AppleStartRequest request, User actor, Purpose purpose) {
        requireEnabled();
        User owner = null;
        // An unbound DELETE flow proves identity directly with Apple, without granting app access.
        // This is also available to pending/suspended users who cannot obtain a normal session.
        if (purpose == Purpose.LINK || (purpose == Purpose.DELETE && actor != null)) {
            if (actor == null) throw AppException.unauthorized("로그인 후 Apple 계정을 연결해 주세요.");
            owner = users.lockById(actor.getId()).orElseThrow(() -> AppException.unauthorized("다시 로그인해 주세요."));
            requireEligible(owner);
            if (owner.getAuthVersion() != actor.getAuthVersion()) throw AppException.unauthorized("다시 로그인해 주세요.");
            var previous = accounts.findById(owner.getId()).orElse(null);
            if (purpose == Purpose.DELETE) {
                if (previous == null || previous.getRevokedAt() != null) throw AppException.badRequest("연결된 Apple 계정으로 다시 로그인한 뒤 삭제를 요청해 주세요.");
            } else {
                if (!owner.isPasswordLoginEnabled() || request.currentPassword() == null || !passwords.matches(request.currentPassword(), owner.getPassword())) throw AppException.badRequest("현재 비밀번호가 올바르지 않습니다.");
                if (previous != null && (previous.getRevokedAt() == null || !notificationStates.canReconnect(notificationStates.find(previous.getSubject()))))
                    throw AppException.conflict("이미 Apple 계정이 연결되어 있거나 삭제 처리 중입니다.");
            }
        }
        if (flows.count() >= 5000) throw new AppException(HttpStatus.TOO_MANY_REQUESTS, "로그인 요청이 많아요. 잠시 후 다시 시도해 주세요.");
        String state = randomToken(), nonce = randomToken();
        var flow = AppleAuthFlow.builder().id(UUID.randomUUID().toString()).stateHash(AppleClient.sha256(state)).nonceHash(AppleClient.sha256(nonce))
            .challenge(request.challenge()).purpose(purpose).stage(Stage.STARTED).expiresAt(Instant.now().plusSeconds(FLOW_SECONDS))
            .user(owner).authVersion(owner == null ? null : owner.getAuthVersion()).build();
        flows.save(flow);
        return Map.of("flowId", flow.getId(), "state", state, "nonce", nonce);
    }

    @Transactional
    public Map<String, Object> complete(AppleCompleteRequest request, User actor) {
        requireEnabled();
        var flow = verified(request.flowId(), request.verifier(), Stage.STARTED);
        if (!AppleClient.constantEquals(flow.getStateHash(), AppleClient.sha256(request.state()))) throw invalid();
        boolean unboundDeletion = flow.getPurpose() == Purpose.DELETE && flow.getUser() == null;
        if (flow.getPurpose() != Purpose.LOGIN && !unboundDeletion) {
            if (actor == null || flow.getUser() == null || !flow.getUser().getId().equals(actor.getId())) throw AppException.forbidden("연결을 시작한 계정으로 다시 로그인해 주세요.");
            requireEligible(actor);
            if (actor.getAuthVersion() != flow.getAuthVersion()) throw AppException.unauthorized("계정 상태가 변경됐어요. 연결을 다시 시작해 주세요.");
        }
        // Lock order is flow -> scoped Apple subject -> user -> account. Notifications never lock flows.
        String subject = apple.verifiedSubject(request.identityToken(), flow.getNonceHash());
        var notificationState = notificationStates.lock(subject);
        notificationStates.requireFreshGrant(notificationState, grantStarted(flow));
        User owner = null;
        if (flow.getPurpose() != Purpose.LOGIN && !unboundDeletion) {
            if (actor == null || flow.getUser() == null || !flow.getUser().getId().equals(actor.getId())) throw AppException.forbidden("연결을 시작한 계정으로 다시 로그인해 주세요.");
            owner = users.lockById(actor.getId()).orElseThrow(() -> AppException.unauthorized("다시 로그인해 주세요."));
            requireEligible(owner);
            if (owner.getAuthVersion() != flow.getAuthVersion()) throw AppException.unauthorized("계정 상태가 변경됐어요. 연결을 다시 시작해 주세요.");
        }
        // Resolve the verified identity before exchanging its code. Pending deletion must not create a new provider grant.
        Long existingOwner = accounts.findUserIdBySubject(subject).orElse(null);
        AppleAccount existingAccount = null;
        if (flow.getPurpose() == Purpose.DELETE) {
            if (unboundDeletion) {
                if (existingOwner == null) throw AppException.badRequest("이 Apple 계정에 연결된 앱 계정을 확인할 수 없습니다.");
                owner = users.lockById(existingOwner).orElseThrow(AppleAuthService::invalid);
            }
            if (existingOwner == null || !existingOwner.equals(owner.getId())) throw AppException.forbidden("삭제할 계정에 연결된 Apple 계정으로 인증해 주세요.");
            existingAccount = accounts.lockByUserId(owner.getId()).orElseThrow(AppleAuthService::invalid);
            if ((!unboundDeletion && existingAccount.getRevokedAt() != null) || !subject.equals(existingAccount.getSubject())) throw invalid();
        } else if (flow.getPurpose() == Purpose.LINK) {
            if (existingOwner != null && !existingOwner.equals(owner.getId())) throw AppException.conflict("이 Apple 계정은 다른 회원에게 연결되어 있어요.");
            existingAccount = accounts.lockByUserId(owner.getId()).orElse(null);
            if (existingAccount != null && (!subject.equals(existingAccount.getSubject()) || existingAccount.getRevokedAt() == null
                    || !notificationStates.canReconnect(notificationState))) throw AppException.conflict("이미 Apple 계정이 연결되어 있거나 삭제 처리 중입니다.");
        } else if (existingOwner != null) {
            owner = users.lockById(existingOwner).orElseThrow(() -> AppException.unauthorized("다시 로그인해 주세요."));
            requireEligible(owner);
            existingAccount = accounts.lockByUserId(owner.getId()).orElseThrow(AppleAuthService::invalid);
            if (!subject.equals(existingAccount.getSubject()) || (existingAccount.getRevokedAt() != null
                    && (owner.isPasswordLoginEnabled() || !notificationStates.canReconnect(notificationState))))
                throw AppException.forbidden("Apple 연결이 해제되어 있습니다. 이메일로 로그인한 뒤 내 정보에서 다시 연결해 주세요.");
        }
        var credential = apple.identify(request.identityToken(), request.authorizationCode(), flow.getNonceHash());
        if (!subject.equals(credential.subject())) throw invalid();
        String protectedToken = cipher.encrypt(credential.refreshToken(), credential.subject());
        if (flow.getPurpose() == Purpose.DELETE) {
            // Keep the newly verified grant revocable, and bind the one-time proof to this exact owner/session.
            existingAccount.setRefreshTokenCiphertext(protectedToken);
            existingAccount.setRevokedAt(null);
            notificationStates.grant(notificationState, owner.getId(), grantStarted(flow));
            String ticket = randomToken();
            flow.setUser(owner); flow.setAuthVersion(owner.getAuthVersion());
            flow.setSubject(subject); flow.setTicketHash(AppleClient.sha256(ticket)); flow.setStage(Stage.DELETE_READY);
            return Map.of("status", "REAUTHENTICATED", "flowId", flow.getId(), "ticket", ticket);
        }
        if (flow.getPurpose() == Purpose.LINK) {
            if (existingAccount == null) accounts.saveAndFlush(AppleAccount.builder().user(owner).subject(credential.subject()).refreshTokenCiphertext(protectedToken).build());
            else { existingAccount.setRefreshTokenCiphertext(protectedToken); existingAccount.setRevokedAt(null); }
            notificationStates.grant(notificationState, owner.getId(), grantStarted(flow));
            flows.delete(flow);
            return Map.of("status", "LINKED");
        }
        if (existingOwner != null) {
            existingAccount.setRefreshTokenCiphertext(protectedToken);
            existingAccount.setRevokedAt(null);
            notificationStates.grant(notificationState, owner.getId(), grantStarted(flow));
            var session = auth.issueSession(owner);
            flows.delete(flow);
            return Map.of("status", "SIGNED_IN", "session", session, "appleSubject", subject);
        }
        if (credential.verifiedEmail() == null) throw AppException.badRequest("Apple에서 확인된 이메일을 받지 못했습니다. Apple 로그인 권한을 확인한 뒤 다시 시도해 주세요.");
        if (credential.verifiedEmail().endsWith("@review.newaveflow.invalid")) throw AppException.badRequest("심사용 이메일은 일반 회원가입에 사용할 수 없습니다.");
        String ticket = randomToken();
        flow.setSubject(credential.subject()); flow.setRefreshTokenCiphertext(protectedToken);
        flow.setVerifiedEmail(credential.verifiedEmail()); flow.setEmailPrivate(credential.emailPrivate());
        flow.setTicketHash(AppleClient.sha256(ticket)); flow.setStage(Stage.REGISTERING);
        return Map.of("status", "REGISTRATION_REQUIRED", "flowId", flow.getId(), "ticket", ticket,
            "email", credential.verifiedEmail(), "emailPrivate", credential.emailPrivate());
    }

    @Transactional
    public void register(AppleRegisterRequest request) {
        RegistrationEligibility.requireConfirmed(request.getEligibilityConfirmed());
        requireEnabled();
        var flow = verified(request.getFlowId(), request.getVerifier(), Stage.REGISTERING);
        if (!AppleClient.constantEquals(flow.getTicketHash(), AppleClient.sha256(request.getTicket())) || flow.getPurpose() != Purpose.LOGIN || flow.getSubject() == null) throw invalid();
        var notificationState = notificationStates.lock(flow.getSubject());
        notificationStates.requireFreshGrant(notificationState, grantStarted(flow));
        if (accounts.findUserIdBySubject(flow.getSubject()).isPresent()) throw AppException.conflict("이미 가입되거나 삭제 처리 중인 Apple 계정입니다.");
        String email = flow.getVerifiedEmail();
        if (email == null || email.isBlank()) throw invalid();
        if (users.existsByEmailIgnoreCase(email)) throw AppException.conflict("이미 가입된 이메일입니다. 이메일로 로그인한 뒤 내 정보에서 Apple 계정을 연결해 주세요.");
        if (email.endsWith("@review.newaveflow.invalid")) throw AppException.badRequest("심사용 이메일은 일반 회원가입에 사용할 수 없습니다.");
        if (request.getName() == null || request.getName().trim().isEmpty() || request.getName().length() > 50 || email.length() > 100
            || (request.getPhone() != null && request.getPhone().length() > 20)) throw AppException.badRequest("이름과 연락처를 확인해 주세요.");
        User user = users.saveAndFlush(User.builder().name(request.getName().trim()).email(email).phone(request.getPhone())
            .role(User.Role.TEACHER).isActive(false).build());
        accounts.saveAndFlush(AppleAccount.builder().user(user).subject(flow.getSubject()).refreshTokenCiphertext(flow.getRefreshTokenCiphertext()).build());
        notificationStates.grant(notificationState, user.getId(), grantStarted(flow));
        flows.delete(flow);
        // The normal administrator approval remains mandatory; registration never returns a session.
    }

    /** Consume inside the deletion transaction, before it locks the user: flow -> subject -> user -> account. */
    @Transactional
    public User consumeDeletionProof(User actor, String flowId, String ticket, String verifier) {
        if (flowId == null || ticket == null || verifier == null) throw AppException.badRequest("Apple 계정으로 다시 인증해 주세요.");
        var flow = verified(flowId, verifier, Stage.DELETE_READY);
        if (flow.getPurpose() != Purpose.DELETE || flow.getUser() == null || flow.getAuthVersion() == null
                || (actor != null && (!flow.getUser().getId().equals(actor.getId()) || flow.getAuthVersion() != actor.getAuthVersion()))
                || !AppleClient.constantEquals(flow.getTicketHash(), AppleClient.sha256(ticket))) throw invalid();
        var state = notificationStates.lock(flow.getSubject());
        notificationStates.requireFreshGrant(state, grantStarted(flow));
        var owner = users.lockById(flow.getUser().getId()).orElseThrow(AppleAuthService::invalid);
        if (actor != null) requireEligible(owner);
        if (owner.getAuthVersion() != flow.getAuthVersion()) throw invalid();
        var account = accounts.lockByUserId(owner.getId()).orElseThrow(AppleAuthService::invalid);
        if (account.getRevokedAt() != null || !account.getSubject().equals(flow.getSubject())) throw invalid();
        flows.delete(flow);
        return owner;
    }

    /** Called inside the authenticated account-deletion transaction, after password or Apple reauthentication. */
    @Transactional
    public void revokeForDeletion(Long userId) {
        User user = users.lockById(userId).orElseThrow(() -> AppException.notFound("사용자를 찾을 수 없습니다."));
        var account = accounts.lockByUserId(userId).orElse(null);
        if (account == null || account.getRevokedAt() != null) return;
        // Revocation remains available when login is disabled, provided the original credentials remain configured.
        apple.revoke(cipher.decrypt(account.getRefreshTokenCiphertext(), account.getSubject()));
        account.setRefreshTokenCiphertext(null);
        account.setRevokedAt(Instant.now());
        user.revokeSessions();
        // Retain the subject until final deletion so a previously issued flow cannot recreate the connection.
        // No flow locks here: complete() takes flow -> user -> account locks, avoiding a reverse-order deadlock.
    }

    private AppleAuthFlow verified(String id, String verifier, Stage stage) {
        var flow = flows.lockById(id).orElseThrow(AppleAuthService::invalid);
        if (!flow.getExpiresAt().isAfter(Instant.now()) || flow.getStage() != stage || !AppleClient.constantEquals(flow.getChallenge(), challenge(verifier))) throw invalid();
        return flow;
    }
    // Flow creation predates Apple's one-time grant. Using it as a lower bound is deliberately conservative at same-second boundaries.
    private static long grantStarted(AppleAuthFlow flow) { return flow.getExpiresAt().minusSeconds(FLOW_SECONDS).getEpochSecond(); }
    private void requireEligible(User user) {
        if (!user.isActive()) throw AppException.unauthorized("승인 대기 중이거나 비활성화된 계정입니다. 관리자에게 문의해주세요.");
        if (deletions.existsByUserId(user.getId())) throw AppException.forbidden("계정 삭제를 처리 중입니다. Apple 로그인과 연결을 사용할 수 없습니다.");
    }
    private void requireEnabled() { if (!config.isEnabled()) throw AppException.badRequest("Apple 로그인 준비 중입니다. 이메일로 로그인해 주세요."); }
    private static AppException invalid() { return AppException.badRequest("인증 시간이 지났거나 확인할 수 없어요. Apple 로그인을 다시 시작해 주세요."); }
    public static String challenge(String verifier) {
        try { return Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
    private static String randomToken() { byte[] bytes = new byte[32]; RANDOM.nextBytes(bytes); return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); }
}
