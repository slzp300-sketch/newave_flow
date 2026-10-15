package com.newaveflow.service;

import com.newaveflow.config.KakaoProperties;
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
import static com.newaveflow.entity.KakaoAuthFlow.*;

@Service @RequiredArgsConstructor
public class KakaoAuthService {
    private final KakaoProperties config;
    private final KakaoClient kakao;
    private final KakaoAuthFlowRepository flows;
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final AuthService auth;
    private static final SecureRandom RANDOM = new SecureRandom();

    @Scheduled(fixedDelay = 60000) @Transactional
    public void cleanup() { flows.deleteExpired(Instant.now()); }

    @Transactional
    public Map<String, String> start(KakaoStartRequest request, User actor, Purpose purpose) {
        requireEnabled();
        User owner = null;
        if (purpose == Purpose.LINK) {
            if (actor == null) throw AppException.unauthorized("로그인 후 카카오 계정을 연결해 주세요.");
            owner = users.lockById(actor.getId()).orElseThrow(() -> AppException.unauthorized("다시 로그인해 주세요."));
            if (!owner.isActive() || owner.getAuthVersion() != actor.getAuthVersion()) throw AppException.unauthorized("다시 로그인해 주세요.");
            if (request.currentPassword() == null || !passwords.matches(request.currentPassword(), owner.getPassword())) {
                throw AppException.badRequest("현재 비밀번호가 올바르지 않습니다.");
            }
            if (owner.getKakaoId() != null) throw AppException.conflict("이미 카카오 계정이 연결되어 있어요.");
        }
        flows.deleteExpired(Instant.now());
        if (flows.count() >= 5000) throw new AppException(HttpStatus.TOO_MANY_REQUESTS, "로그인 요청이 많아요. 잠시 후 다시 시도해 주세요.");
        String state = randomToken();
        var flow = KakaoAuthFlow.builder().id(UUID.randomUUID().toString()).stateHash(hexHash(state))
            .challenge(request.challenge()).purpose(purpose).stage(Stage.STARTED).nativeClient(Set.of("android", "ios").contains(request.platform()))
            .expiresAt(Instant.now().plusSeconds(600)).user(owner).authVersion(owner == null ? null : owner.getAuthVersion()).build();
        flows.save(flow);
        String url = "https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=" + KakaoClient.encode(config.getClientId())
            + "&redirect_uri=" + KakaoClient.encode(config.getRedirectUri()) + "&state=" + state;
        // No application JWT or password is placed in any redirect URL.
        return Map.of("flowId", flow.getId(), "authorizationUrl", url);
    }

    @Transactional
    public String callback(String state, String code, String error) {
        requireEnabled();
        if (state == null || !state.matches("[A-Za-z0-9_-]{43}")) return config.getWebReturnUri() + "#error=expired";
        var flow = flows.lockByStateHash(hexHash(state)).orElse(null);
        if (flow == null || flow.getStage() != Stage.STARTED || expired(flow)) return config.getWebReturnUri() + "#error=expired";
        if (error != null || code == null || code.isBlank() || code.length() > 2048) {
            flow.setFailure("cancelled");
        } else {
            try { flow.setKakaoId(kakao.identify(code)); }
            catch (AppException e) { flow.setFailure("provider"); }
        }
        String ticket = randomToken();
        flow.setTicketHash(hexHash(ticket)); flow.setStage(Stage.AUTHORIZED);
        String target = flow.isNativeClient() ? "newaveflow://auth/kakao" : config.getWebReturnUri();
        return target + "#flow=" + flow.getId() + "&ticket=" + ticket;
    }

    @Transactional
    public Map<String, Object> complete(KakaoCompleteRequest request, User actor) {
        requireEnabled();
        var flow = verified(request.flowId(), request.ticket(), request.verifier(), Stage.AUTHORIZED);
        if (flow.getFailure() != null) {
            flows.delete(flow);
            return Map.of("status", "FAILED", "message", "cancelled".equals(flow.getFailure()) ? "카카오 인증을 취소했어요." : "카카오 연결을 완료하지 못했어요. 다시 시도해 주세요.");
        }
        var existing = users.findByKakaoId(flow.getKakaoId()).orElse(null);
        if (flow.getPurpose() == Purpose.LINK) {
            if (actor == null || flow.getUser() == null || !flow.getUser().getId().equals(actor.getId())) {
                throw AppException.forbidden("연결을 시작한 계정으로 다시 로그인해 주세요.");
            }
            User owner = users.lockById(actor.getId()).orElseThrow(() -> AppException.unauthorized("다시 로그인해 주세요."));
            if (!owner.isActive() || owner.getAuthVersion() != flow.getAuthVersion()) throw AppException.unauthorized("계정 상태가 변경됐어요. 연결을 다시 시작해 주세요.");
            if (existing != null && !existing.getId().equals(owner.getId())) throw AppException.conflict("이 카카오 계정은 다른 회원에게 연결되어 있어요.");
            if (owner.getKakaoId() != null && !owner.getKakaoId().equals(flow.getKakaoId())) throw AppException.conflict("이미 다른 카카오 계정이 연결되어 있어요.");
            owner.connectKakao(flow.getKakaoId()); users.saveAndFlush(owner); flows.delete(flow);
            return Map.of("status", "LINKED");
        }
        if (existing != null) {
            // Re-load and lock the account so an approval/revocation cannot race token issuance.
            User account = users.lockById(existing.getId()).orElseThrow(() -> AppException.unauthorized("다시 로그인해 주세요."));
            if (!flow.getKakaoId().equals(account.getKakaoId())) throw AppException.unauthorized("카카오 연결 상태가 변경됐어요. 다시 로그인해 주세요.");
            var session = auth.issueSession(account);
            flows.delete(flow);
            return Map.of("status", "SIGNED_IN", "session", session);
        }
        String registration = randomToken();
        flow.setTicketHash(hexHash(registration)); flow.setStage(Stage.REGISTERING);
        return Map.of("status", "REGISTRATION_REQUIRED", "ticket", registration, "flowId", flow.getId());
    }

    @Transactional
    public void register(KakaoRegisterRequest request) {
        requireEnabled();
        var flow = verified(request.getFlowId(), request.getTicket(), request.getVerifier(), Stage.REGISTERING);
        if (flow.getPurpose() != Purpose.LOGIN || flow.getKakaoId() == null) throw AppException.badRequest("카카오 인증을 다시 시작해 주세요.");
        if (users.findByKakaoId(flow.getKakaoId()).isPresent()) throw AppException.conflict("이미 가입된 카카오 계정입니다. 로그인해 주세요.");
        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCase(email)) throw AppException.conflict("이미 가입된 이메일입니다. 이메일로 로그인한 뒤 내 정보에서 카카오 계정을 연결해 주세요.");
        if (request.getPassword().getBytes(StandardCharsets.UTF_8).length > 72) throw AppException.badRequest("비밀번호가 너무 길어요. 영문 72자 또는 한글 24자 이내로 설정해 주세요.");
        if (request.getName().trim().isEmpty() || request.getName().length() > 50 || email.length() > 100
            || request.getPassword().length() < 8 || request.getPassword().length() > 200
            || (request.getPhone() != null && request.getPhone().length() > 20)) throw AppException.badRequest("이름·이메일과 8자 이상의 비밀번호를 확인해 주세요.");
        User account = User.builder().name(request.getName().trim()).email(email).phone(request.getPhone())
            .password(passwords.encode(request.getPassword())).role(User.Role.TEACHER).isActive(false).kakaoId(flow.getKakaoId()).build();
        users.saveAndFlush(account);
        flows.delete(flow);
        // No session is issued until the existing administrator approval flow succeeds.
    }

    @Transactional
    public void unlink(String authorization, String appId, String kakaoId) {
        if (config.getAdminKey().isBlank() || !constantEquals(authorization, "KakaoAK " + config.getAdminKey())
            || !constantEquals(appId, config.getAppId())) throw AppException.unauthorized("웹훅 인증을 확인하지 못했습니다.");
        if (kakaoId == null || !kakaoId.matches("[1-9][0-9]{0,99}")) throw AppException.badRequest("회원번호를 확인해 주세요.");
        // Lock/delete handoffs before the account, matching complete()'s lock order.
        flows.deleteForKakaoId(kakaoId);
        users.findByKakaoId(kakaoId).ifPresent(existing -> {
            User account = users.lockById(existing.getId()).orElseThrow();
            if (kakaoId.equals(account.getKakaoId())) {
                account.connectKakao(null);
                account.revokeSessions();
            }
        });
        // Every member has an email/password: retain that membership and its church records.
    }

    private KakaoAuthFlow verified(String id, String ticket, String verifier, Stage stage) {
        var flow = flows.lockById(id).orElseThrow(() -> AppException.badRequest("인증 시간이 지났어요. 카카오 로그인을 다시 시작해 주세요."));
        if (expired(flow) || flow.getStage() != stage || !constantEquals(flow.getTicketHash(), hexHash(ticket))
            || !constantEquals(flow.getChallenge(), challenge(verifier))) throw AppException.badRequest("인증을 확인하지 못했어요. 카카오 로그인을 다시 시작해 주세요.");
        return flow;
    }
    private boolean expired(KakaoAuthFlow flow) { return !flow.getExpiresAt().isAfter(Instant.now()); }
    private void requireEnabled() { if (!config.isEnabled()) throw AppException.badRequest("카카오 로그인 준비 중입니다. 이메일로 로그인해 주세요."); }
    private static boolean constantEquals(String a, String b) { return a != null && b != null && MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8)); }
    private static byte[] hash(String value) {
        try { return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    public static String challenge(String verifier) { return Base64.getUrlEncoder().withoutPadding().encodeToString(hash(verifier)); }
    private static String hexHash(String value) { return HexFormat.of().formatHex(hash(value)); }
    private static String randomToken() { byte[] bytes = new byte[32]; RANDOM.nextBytes(bytes); return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); }
}
