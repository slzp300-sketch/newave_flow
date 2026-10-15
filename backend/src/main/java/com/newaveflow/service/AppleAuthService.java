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
        if (purpose == Purpose.LINK) {
            if (actor == null) throw AppException.unauthorized("로그인 후 Apple 계정을 연결해 주세요.");
            owner = users.lockById(actor.getId()).orElseThrow(() -> AppException.unauthorized("다시 로그인해 주세요."));
            requireEligible(owner);
            if (owner.getAuthVersion() != actor.getAuthVersion()) throw AppException.unauthorized("다시 로그인해 주세요.");
            if (request.currentPassword() == null || !passwords.matches(request.currentPassword(), owner.getPassword())) throw AppException.badRequest("현재 비밀번호가 올바르지 않습니다.");
            if (accounts.existsById(owner.getId())) throw AppException.conflict("이미 Apple 계정이 연결되어 있거나 삭제 처리 중입니다.");
        }
        if (flows.count() >= 5000) throw new AppException(HttpStatus.TOO_MANY_REQUESTS, "로그인 요청이 많아요. 잠시 후 다시 시도해 주세요.");
        String state = randomToken(), nonce = randomToken();
        var flow = AppleAuthFlow.builder().id(UUID.randomUUID().toString()).stateHash(AppleClient.sha256(state)).nonceHash(AppleClient.sha256(nonce))
            .challenge(request.challenge()).purpose(purpose).stage(Stage.STARTED).expiresAt(Instant.now().plusSeconds(300))
            .user(owner).authVersion(owner == null ? null : owner.getAuthVersion()).build();
        flows.save(flow);
        return Map.of("flowId", flow.getId(), "state", state, "nonce", nonce);
    }

    @Transactional
    public Map<String, Object> complete(AppleCompleteRequest request, User actor) {
        requireEnabled();
        var flow = verified(request.flowId(), request.verifier(), Stage.STARTED);
        if (!AppleClient.constantEquals(flow.getStateHash(), AppleClient.sha256(request.state()))) throw invalid();
        User owner = null;
        if (flow.getPurpose() == Purpose.LINK) {
            if (actor == null || flow.getUser() == null || !flow.getUser().getId().equals(actor.getId())) throw AppException.forbidden("연결을 시작한 계정으로 다시 로그인해 주세요.");
            owner = users.lockById(actor.getId()).orElseThrow(() -> AppException.unauthorized("다시 로그인해 주세요."));
            requireEligible(owner);
            if (owner.getAuthVersion() != flow.getAuthVersion()) throw AppException.unauthorized("계정 상태가 변경됐어요. 연결을 다시 시작해 주세요.");
        }
        // Resolve the verified identity before exchanging its code. Pending deletion must not create a new provider grant.
        String subject = apple.verifiedSubject(request.identityToken(), flow.getNonceHash());
        Long existingOwner = accounts.findUserIdBySubject(subject).orElse(null);
        AppleAccount existingAccount = null;
        if (flow.getPurpose() == Purpose.LINK) {
            if (existingOwner != null && !existingOwner.equals(owner.getId())) throw AppException.conflict("이 Apple 계정은 다른 회원에게 연결되어 있어요.");
            if (accounts.existsById(owner.getId())) throw AppException.conflict("이미 Apple 계정이 연결되어 있거나 삭제 처리 중입니다.");
        } else if (existingOwner != null) {
            owner = users.lockById(existingOwner).orElseThrow(() -> AppException.unauthorized("다시 로그인해 주세요."));
            requireEligible(owner);
            existingAccount = accounts.lockByUserId(owner.getId()).orElseThrow(AppleAuthService::invalid);
            if (existingAccount.getRevokedAt() != null || !subject.equals(existingAccount.getSubject())) throw AppException.forbidden("삭제 처리 중인 계정은 Apple 로그인을 사용할 수 없습니다.");
        }
        var credential = apple.identify(request.identityToken(), request.authorizationCode(), flow.getNonceHash());
        if (!subject.equals(credential.subject())) throw invalid();
        String protectedToken = cipher.encrypt(credential.refreshToken(), credential.subject());
        if (flow.getPurpose() == Purpose.LINK) {
            accounts.saveAndFlush(AppleAccount.builder().user(owner).subject(credential.subject()).refreshTokenCiphertext(protectedToken).build());
            flows.delete(flow);
            return Map.of("status", "LINKED");
        }
        if (existingOwner != null) {
            existingAccount.setRefreshTokenCiphertext(protectedToken);
            var session = auth.issueSession(owner);
            flows.delete(flow);
            return Map.of("status", "SIGNED_IN", "session", session, "appleSubject", subject);
        }
        String ticket = randomToken();
        flow.setSubject(credential.subject()); flow.setRefreshTokenCiphertext(protectedToken);
        flow.setTicketHash(AppleClient.sha256(ticket)); flow.setStage(Stage.REGISTERING);
        return Map.of("status", "REGISTRATION_REQUIRED", "flowId", flow.getId(), "ticket", ticket);
    }

    @Transactional
    public void register(AppleRegisterRequest request) {
        requireEnabled();
        var flow = verified(request.getFlowId(), request.getVerifier(), Stage.REGISTERING);
        if (!AppleClient.constantEquals(flow.getTicketHash(), AppleClient.sha256(request.getTicket())) || flow.getPurpose() != Purpose.LOGIN || flow.getSubject() == null) throw invalid();
        if (accounts.findUserIdBySubject(flow.getSubject()).isPresent()) throw AppException.conflict("이미 가입되거나 삭제 처리 중인 Apple 계정입니다.");
        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCase(email)) throw AppException.conflict("이미 가입된 이메일입니다. 이메일로 로그인한 뒤 내 정보에서 Apple 계정을 연결해 주세요.");
        if (email.endsWith("@review.newaveflow.invalid")) throw AppException.badRequest("심사용 이메일은 일반 회원가입에 사용할 수 없습니다.");
        if (request.getName().trim().isEmpty() || request.getName().length() > 50 || email.length() > 100
            || request.getPassword().length() < 8 || request.getPassword().getBytes(StandardCharsets.UTF_8).length > 72
            || (request.getPhone() != null && request.getPhone().length() > 20)) throw AppException.badRequest("이름·이메일과 8자 이상의 비밀번호를 확인해 주세요. 비밀번호는 영문 72자 또는 한글 24자 이내입니다.");
        User user = users.saveAndFlush(User.builder().name(request.getName().trim()).email(email).phone(request.getPhone())
            .password(passwords.encode(request.getPassword())).role(User.Role.TEACHER).isActive(false).build());
        accounts.saveAndFlush(AppleAccount.builder().user(user).subject(flow.getSubject()).refreshTokenCiphertext(flow.getRefreshTokenCiphertext()).build());
        flows.delete(flow);
        // The normal administrator approval remains mandatory; registration never returns a session.
    }

    /** Called inside the authenticated account-deletion transaction, after password reauthentication. */
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
