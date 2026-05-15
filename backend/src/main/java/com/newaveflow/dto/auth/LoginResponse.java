package com.newaveflow.dto.auth;

import com.newaveflow.entity.User;

public record LoginResponse(
        String accessToken,
        String refreshToken,
        UserInfo user
) {
    public record UserInfo(
            Long id, String name, String email, String role, String grade,
            boolean isActive, boolean largeFont,
            String phone, String birthDate
    ) {
        public static UserInfo from(User u, String grade) {
            return new UserInfo(
                    u.getId(), u.getName(), u.getEmail(), u.getRole().name(),
                    grade, u.isActive(), u.isLargeFont(),
                    u.getPhone(),
                    u.getBirthDate() != null ? u.getBirthDate().toString() : null
            );
        }
    }

    public static LoginResponse of(String accessToken, String refreshToken, User user) {
        return new LoginResponse(
                accessToken,
                refreshToken,
                UserInfo.from(user, user.getGrade())
        );
    }
}
