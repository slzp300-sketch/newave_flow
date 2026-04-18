package com.newaveflow.dto.auth;

import com.newaveflow.entity.User;

public record LoginResponse(
        String accessToken,
        String refreshToken,
        UserInfo user
) {
    public record UserInfo(Long id, String name, String email, String role, String grade) {}

    public static LoginResponse of(String accessToken, String refreshToken, User user) {
        return new LoginResponse(
                accessToken,
                refreshToken,
                new UserInfo(user.getId(), user.getName(), user.getEmail(), user.getRole().name(), user.getGrade())
        );
    }
}
