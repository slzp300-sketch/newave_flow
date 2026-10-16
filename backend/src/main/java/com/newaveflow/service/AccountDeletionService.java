package com.newaveflow.service;

import com.newaveflow.entity.AccountDeletionRequest;
import com.newaveflow.entity.User;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.AccountDeletionRequestRepository;
import com.newaveflow.repository.UserRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class AccountDeletionService {
    private final UserRepository users;
    private final AccountDeletionRequestRepository requests;
    private final PasswordEncoder passwords;
    private final AppleAuthService apple;
    @org.springframework.beans.factory.annotation.Value("${app.review.mode:false}")
    private boolean reviewMode;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String REQUESTED_MESSAGE = "계정 삭제 요청이 접수되었습니다. 담당자가 개인 자료·본인 작성 내용의 삭제와 공동 기록 처리를 확인해 7일 이내 처리를 목표로 진행합니다. 현재 로그인은 종료되며 Apple 연결이 있으면 함께 해제됩니다. 저장한 접수증으로 처리 상태를 확인해 주세요.";

    public record SubmitRequest(@Size(max = 200) String password, boolean confirmed,
        @Size(max = 36) String appleFlowId, @Size(max = 43) String appleTicket, @Size(max = 43) String appleVerifier) {}
    public record PublicSubmitRequest(@Size(max = 100) String email, @Size(max = 200) String password, boolean confirmed,
        @Size(max = 36) String appleFlowId, @Size(max = 43) String appleTicket, @Size(max = 43) String appleVerifier) {}
    public record StatusRequest(@NotBlank @Size(min = 43, max = 43) String receiptToken) {}
    public record View(String requestId, String status, Instant requestedAt, Instant targetAt, Instant completedAt,
                       String message, boolean handoverRequired, String reauthenticationMethod) {}
    public record Receipt(String requestId, String status, Instant requestedAt, Instant targetAt, Instant completedAt,
                          String message, boolean handoverRequired, String receiptToken) {}

    public View current(User actor) {
        return requests.findByUserId(actor.getId()).map(this::view)
            .orElse(new View(null, "NONE", null, null, null, "아직 접수된 계정 삭제 요청이 없습니다.", false, actor.isPasswordLoginEnabled() ? "PASSWORD" : "APPLE"));
    }

    @Transactional
    public Receipt submit(User actor, SubmitRequest input) {
        if (!input.confirmed()) throw AppException.badRequest("계정과 개인 자료 삭제 안내를 확인해 주세요.");
        // Serialize retries and check the current account version after the authentication filter.
        boolean appleProof = input.appleFlowId() != null || input.appleTicket() != null || input.appleVerifier() != null;
        // Apple proof acquires flow/subject locks first, consistent with authentication and notifications.
        User owner = appleProof ? apple.consumeDeletionProof(actor, input.appleFlowId(), input.appleTicket(), input.appleVerifier())
            : users.lockById(actor.getId()).orElseThrow(() -> AppException.unauthorized("다시 로그인해 주세요."));
        if (!owner.isActive() || owner.getAuthVersion() != actor.getAuthVersion()) {
            throw AppException.unauthorized("계정 상태가 변경됐습니다. 다시 로그인해 주세요.");
        }
        if (!appleProof && (!owner.isPasswordLoginEnabled() || input.password() == null || input.password().length() > 200 || !passwords.matches(input.password(), owner.getPassword()))) {
            throw AppException.badRequest("현재 비밀번호가 올바르지 않습니다.");
        }
        return accept(owner);
    }

    /** Credential proof permits deletion only; it never approves an account or issues a login token. */
    @Transactional
    public Receipt submitWithoutSession(PublicSubmitRequest input) {
        if (!input.confirmed()) throw AppException.badRequest("계정과 개인 자료 삭제 안내를 확인해 주세요.");
        boolean appleProof = input.appleFlowId() != null || input.appleTicket() != null || input.appleVerifier() != null;
        User owner;
        if (appleProof) {
            if (input.email() != null || input.password() != null) throw AppException.badRequest("본인 확인 방법을 하나만 선택해 주세요.");
            owner = apple.consumeDeletionProof(null, input.appleFlowId(), input.appleTicket(), input.appleVerifier());
        } else {
            String email = input.email() == null ? "" : input.email().trim().toLowerCase(Locale.ROOT);
            if (email.isEmpty() || input.password() == null || input.password().isEmpty()
                || (!reviewMode && email.endsWith("@review.newaveflow.invalid"))) throw invalidCredentials();
            var found = users.findByEmailIgnoreCase(email).orElseThrow(AccountDeletionService::invalidCredentials);
            owner = users.lockById(found.getId()).orElseThrow(AccountDeletionService::invalidCredentials);
            // Check the locked current credentials, including after password changes or suspension.
            if (!owner.getEmail().equalsIgnoreCase(email) || !owner.isPasswordLoginEnabled()
                || !passwords.matches(input.password(), owner.getPassword())) throw invalidCredentials();
        }
        return accept(owner);
    }

    private static AppException invalidCredentials() { return AppException.unauthorized("이메일 또는 비밀번호를 확인해 주세요."); }

    private Receipt accept(User owner) {
        if (owner.getCreatedAt() == null) throw AppException.conflict("계정 확인에 필요한 정보가 없습니다. 담당자에게 문의해 주세요.");
        // Provider revocation must succeed before the request is acknowledged. It is idempotent.
        long authenticatedVersion = owner.getAuthVersion();
        apple.revokeForDeletion(owner.getId());
        // End every current session for every provider. Apple revocation may already have bumped it.
        if (owner.getAuthVersion() == authenticatedVersion) owner.revokeSessions();
        String token = randomToken();
        AccountDeletionRequest request = requests.findByUserId(owner.getId()).orElseGet(() -> {
            Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
            boolean handover = owner.getRole() == User.Role.ADMIN && users.findByRoleAndIsActiveTrue(User.Role.ADMIN).size() <= 1;
            return AccountDeletionRequest.builder().id(UUID.randomUUID().toString()).user(owner)
                .userCreatedAt(owner.getCreatedAt()).status(AccountDeletionRequest.Status.REQUESTED)
                .requestedAt(now).targetAt(now.plus(7, ChronoUnit.DAYS)).handoverRequired(handover).build();
        });
        // A password-authenticated retry renews only its receipt, never the deletion request or its deadline.
        request.renewReceipt(hash(token));
        requests.saveAndFlush(request);
        View state = view(request);
        return new Receipt(state.requestId(), state.status(), state.requestedAt(), state.targetAt(), state.completedAt(),
            state.message(), state.handoverRequired(), token);
    }

    public View status(String token) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) throw unknownReceipt();
        AccountDeletionRequest request = requests.findByReceiptTokenHash(hash(token)).orElseThrow(this::unknownReceipt);
        if (request.getCompletedAt() != null && request.getCompletedAt().isBefore(Instant.now().minus(30, ChronoUnit.DAYS))) {
            throw unknownReceipt();
        }
        return view(request);
    }

    @Scheduled(fixedDelay = 3600000) @Transactional
    public void cleanupCompletedReceipts() {
        // Pending requests are never discarded by age. Completed receipts no longer contain an account reference.
        requests.deleteCompletedBefore(Instant.now().minus(30, ChronoUnit.DAYS), AccountDeletionRequest.Status.COMPLETED);
    }

    private View view(AccountDeletionRequest request) {
        boolean complete = request.getStatus() == AccountDeletionRequest.Status.COMPLETED;
        String message = complete
            ? "계정·개인 자료·본인 작성 내용의 삭제와 공동 기록 처리가 완료되었습니다. 보관 중인 암호화 백업은 생성 후 30일 이내 만료되며, 복원 시 삭제를 다시 적용합니다. 접수증은 완료 후 30일 동안 확인할 수 있습니다."
            : REQUESTED_MESSAGE + (request.isHandoverRequired() ? " 마지막 관리자 계정이므로 운영 권한 인계를 확인한 뒤 완료합니다." : "");
        return new View(request.getId(), request.getStatus().name(), request.getRequestedAt(), request.getTargetAt(),
            request.getCompletedAt(), message, request.isHandoverRequired(), request.getUser() == null ? null : request.getUser().isPasswordLoginEnabled() ? "PASSWORD" : "APPLE");
    }

    private AppException unknownReceipt() { return AppException.notFound("접수증을 확인할 수 없습니다. 저장된 접수증으로 다시 확인해 주세요."); }
    private static String randomToken() { byte[] bytes = new byte[32]; RANDOM.nextBytes(bytes); return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); }
    private static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException("SHA-256 unavailable", e); }
    }
}
