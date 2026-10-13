package com.newaveflow.controller;

import com.newaveflow.config.KakaoProperties;
import com.newaveflow.dto.auth.*;
import com.newaveflow.entity.User;
import com.newaveflow.service.KakaoAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.Map;
import static com.newaveflow.entity.KakaoAuthFlow.Purpose;

@RestController @RequiredArgsConstructor
public class KakaoAuthController {
    private final KakaoAuthService service;
    private final KakaoProperties config;
    @GetMapping("/api/auth/kakao/config")
    public Map<String, Boolean> config() { return Map.of("enabled", config.isEnabled()); }
    @GetMapping("/api/users/me/kakao")
    public Map<String, Boolean> status(@AuthenticationPrincipal User user) { return Map.of("connected", user.getKakaoId() != null, "enabled", config.isEnabled()); }
    @PostMapping("/api/auth/kakao/start")
    public ResponseEntity<Map<String, String>> login(@Valid @RequestBody KakaoStartRequest request) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.start(request, null, Purpose.LOGIN)); }
    @PostMapping("/api/users/me/kakao/start")
    public ResponseEntity<Map<String, String>> link(@Valid @RequestBody KakaoStartRequest request, @AuthenticationPrincipal User user) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.start(request, user, Purpose.LINK)); }
    @GetMapping("/api/auth/kakao/callback")
    public ResponseEntity<Void> callback(@RequestParam(required=false) String state, @RequestParam(required=false) String code, @RequestParam(required=false) String error) {
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(service.callback(state, code, error)))
            .cacheControl(CacheControl.noStore()).header("Referrer-Policy", "no-referrer").build();
    }
    @PostMapping("/api/auth/kakao/complete")
    public ResponseEntity<Map<String, Object>> complete(@Valid @RequestBody KakaoCompleteRequest request, @AuthenticationPrincipal User user) {
        try { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.complete(request, user)); }
        catch (DataIntegrityViolationException e) { throw com.newaveflow.exception.AppException.conflict("계정 연결 상태가 변경됐어요. 다시 로그인해 주세요."); }
    }
    @RequestMapping(value="/api/auth/kakao/unlink", method={RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<Void> unlink(@RequestHeader(value="Authorization", required=false) String authorization,
        @RequestParam(required=false) String app_id, @RequestParam(required=false) String user_id) {
        service.unlink(authorization, app_id, user_id);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).build();
    }
    @PostMapping("/api/auth/kakao/register")
    public ResponseEntity<Void> register(@Valid @RequestBody KakaoRegisterRequest request) {
        try { service.register(request); }
        catch (DataIntegrityViolationException e) { throw com.newaveflow.exception.AppException.conflict("이미 가입되거나 연결된 계정입니다. 기존 계정으로 로그인해 주세요."); }
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore()).build();
    }
}
