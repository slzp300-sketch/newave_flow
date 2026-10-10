package com.newaveflow.service;

import com.newaveflow.dto.auth.FindEmailRequest;
import com.newaveflow.dto.auth.FindEmailResponse;
import com.newaveflow.dto.auth.LoginRequest;
import com.newaveflow.dto.auth.LoginResponse;
import com.newaveflow.dto.auth.ResetPasswordRequest;
import com.newaveflow.dto.auth.ResetPasswordResponse;
import com.newaveflow.entity.User;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.UserRepository;
import com.newaveflow.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    private final UserRepository   userRepository;
    private final PasswordEncoder  passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmailIgnoreCase(request.email())
                .orElseThrow(() -> AppException.unauthorized("이메일 또는 비밀번호가 올바르지 않습니다."));

        if (!user.isActive()) {
            throw AppException.unauthorized("승인 대기 중이거나 비활성화된 계정입니다. 관리자에게 문의해주세요.");
        }

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw AppException.unauthorized("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        String role         = user.getRole().name();
        String accessToken  = tokenProvider.createAccessToken(user.getId(), user.getEmail(), role, user.getAuthVersion());
        String refreshToken = tokenProvider.createRefreshToken(user.getId(), user.getEmail(), role, user.getAuthVersion());

        return LoginResponse.of(accessToken, refreshToken, user);
    }

    public LoginResponse refresh(String refreshToken) {
        io.jsonwebtoken.Claims claims;
        try {
            claims = tokenProvider.requireToken(refreshToken, "refresh");
        } catch (io.jsonwebtoken.JwtException | IllegalArgumentException e) {
            throw AppException.unauthorized("유효하지 않은 토큰입니다. 다시 로그인해주세요.");
        }

        Long userId;
        try { userId = Long.valueOf(claims.getSubject()); }
        catch (RuntimeException e) { throw AppException.unauthorized("유효하지 않은 토큰입니다."); }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> AppException.unauthorized("사용자를 찾을 수 없습니다."));

        if (!tokenProvider.matchesUser(claims, user)) {
            throw AppException.unauthorized("계정 상태가 변경되었습니다. 다시 로그인해주세요.");
        }
        String newAccessToken  = tokenProvider.createAccessToken(userId, user.getEmail(), user.getRole().name(), user.getAuthVersion());
        String newRefreshToken = tokenProvider.createRefreshToken(userId, user.getEmail(), user.getRole().name(), user.getAuthVersion());

        return LoginResponse.of(newAccessToken, newRefreshToken, user);
    }

    @Transactional
    public void register(com.newaveflow.dto.auth.RegisterRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw AppException.badRequest("이미 가입된 이메일입니다.");
        }

        User user = User.builder()
                .name(request.getName())
                .email(normalizedEmail)
                .password(passwordEncoder.encode(request.getPassword()))
                .phone(request.getPhone())
                .role(User.Role.TEACHER)
                .isActive(false) // 관리자 승인 대기
                .build();
        
        userRepository.save(user);
    }

    public boolean checkEmailDuplicate(String email) {
        return userRepository.existsByEmailIgnoreCase(email.trim().toLowerCase());
    }

    public boolean checkNameDuplicate(String name) {
        return userRepository.existsByName(name);
    }

    public FindEmailResponse findEmail(FindEmailRequest request) {
        String normalizedPhone = request.phone().replaceAll("[^0-9]", "");
        User user = userRepository.findByNameAndPhone(request.name(), normalizedPhone)
                .or(() -> userRepository.findByNameAndPhone(request.name(), request.phone()))
                .orElseThrow(() -> AppException.badRequest("입력하신 정보와 일치하는 계정을 찾을 수 없습니다."));
        return FindEmailResponse.of(user.getEmail());
    }

    @Transactional
    public ResetPasswordResponse resetPassword(ResetPasswordRequest request) {
        throw AppException.forbidden("비밀번호 재설정은 부서 관리자에게 본인 확인 후 요청해주세요.");
    }

    @Transactional
    public ResetPasswordResponse resetPasswordByAdmin(Long userId, User actor, boolean identityVerified) {
        if (actor == null || actor.getRole() != User.Role.ADMIN || !identityVerified) {
            throw AppException.forbidden("최종 관리자의 본인 확인이 필요합니다.");
        }
        User user = userRepository.lockById(userId)
                .orElseThrow(() -> AppException.notFound("사용자를 찾을 수 없습니다."));
        String tempPassword = generateTempPassword();
        user.updatePassword(passwordEncoder.encode(tempPassword));
        userRepository.save(user);
        return new ResetPasswordResponse(tempPassword);
    }

    private static final String TEMP_PW_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

    private String generateTempPassword() {
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(20);
        for (int i = 0; i < 20; i++) {
            sb.append(TEMP_PW_CHARS.charAt(random.nextInt(TEMP_PW_CHARS.length())));
        }
        return sb.toString();
    }

    @Transactional
    public void changePassword(Long userId, String currentPassword, String newPassword) {
        User user = userRepository.lockById(userId)
                .orElseThrow(() -> AppException.badRequest("사용자를 찾을 수 없습니다."));

        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw AppException.badRequest("현재 비밀번호가 올바르지 않습니다.");
        }

        if (newPassword == null || newPassword.length() < 8) {
            throw AppException.badRequest("새 비밀번호는 8자 이상이어야 합니다.");
        }

        user.updatePassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    @Transactional
    public void logout(Long userId) {
        userRepository.lockById(userId).ifPresent(User::revokeSessions);
    }
}
