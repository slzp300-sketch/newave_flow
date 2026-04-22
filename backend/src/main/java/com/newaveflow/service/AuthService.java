package com.newaveflow.service;

import com.newaveflow.dto.auth.LoginRequest;
import com.newaveflow.dto.auth.LoginResponse;
import com.newaveflow.entity.User;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.UserRepository;
import com.newaveflow.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    private final UserRepository   userRepository;
    private final PasswordEncoder  passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> AppException.unauthorized("이메일 또는 비밀번호가 올바르지 않습니다."));

        if (!user.isActive()) {
            throw AppException.unauthorized("승인 대기 중이거나 비활성화된 계정입니다. 관리자에게 문의해주세요.");
        }

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw AppException.unauthorized("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        String role         = user.getRole().name();
        String accessToken  = tokenProvider.createAccessToken(user.getId(), user.getEmail(), role);
        String refreshToken = tokenProvider.createRefreshToken(user.getId(), user.getEmail(), role);

        return LoginResponse.of(accessToken, refreshToken, user);
    }

    public LoginResponse refresh(String refreshToken) {
        if (!tokenProvider.validateToken(refreshToken)) {
            throw AppException.unauthorized("유효하지 않은 토큰입니다. 다시 로그인해주세요.");
        }

        Long   userId = tokenProvider.getUserId(refreshToken);
        String role   = tokenProvider.getRole(refreshToken);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> AppException.unauthorized("사용자를 찾을 수 없습니다."));

        String newAccessToken  = tokenProvider.createAccessToken(userId, user.getEmail(), role);
        String newRefreshToken = tokenProvider.createRefreshToken(userId, user.getEmail(), role);

        return LoginResponse.of(newAccessToken, newRefreshToken, user);
    }

    @Transactional
    public void register(com.newaveflow.dto.auth.RegisterRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw AppException.badRequest("이미 가입된 이메일입니다.");
        }

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .phone(request.getPhone())
                .role(User.Role.TEACHER)
                .isActive(false) // 관리자 승인 대기
                .build();
        
        userRepository.save(user);
    }
}
