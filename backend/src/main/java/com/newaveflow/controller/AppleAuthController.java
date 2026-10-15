package com.newaveflow.controller;

import com.newaveflow.config.AppleProperties;
import com.newaveflow.dto.auth.*;
import com.newaveflow.entity.User;
import com.newaveflow.exception.AppException;
import com.newaveflow.service.AppleAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import static com.newaveflow.entity.AppleAuthFlow.Purpose;

@RestController @RequiredArgsConstructor
public class AppleAuthController {
    private final AppleAuthService service;
    private final AppleProperties config;
    @GetMapping("/api/auth/apple/config")
    public ResponseEntity<Map<String, Boolean>> config() { return ok(Map.of("enabled", config.isEnabled())); }
    @GetMapping("/api/users/me/apple")
    public ResponseEntity<Map<String, Boolean>> status(@AuthenticationPrincipal User user) { return ok(service.status(user)); }
    @PostMapping("/api/auth/apple/start")
    public ResponseEntity<Map<String, String>> login(@Valid @RequestBody AppleStartRequest request) { return ok(service.start(request, null, Purpose.LOGIN)); }
    @PostMapping("/api/users/me/apple/start")
    public ResponseEntity<Map<String, String>> link(@Valid @RequestBody AppleStartRequest request, @AuthenticationPrincipal User user) { return ok(service.start(request, user, Purpose.LINK)); }
    @PostMapping("/api/auth/apple/complete")
    public ResponseEntity<Map<String, Object>> complete(@Valid @RequestBody AppleCompleteRequest request, @AuthenticationPrincipal User user) {
        try { return ok(service.complete(request, user)); }
        catch (DataIntegrityViolationException e) { throw AppException.conflict("계정 연결 상태가 변경됐어요. 다시 로그인해 주세요."); }
    }
    @PostMapping("/api/auth/apple/register")
    public ResponseEntity<Void> register(@Valid @RequestBody AppleRegisterRequest request) {
        try { service.register(request); }
        catch (DataIntegrityViolationException e) { throw AppException.conflict("이미 가입되거나 연결된 계정입니다. 기존 계정으로 로그인해 주세요."); }
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore()).build();
    }
    private static <T> ResponseEntity<T> ok(T body) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body); }
}
