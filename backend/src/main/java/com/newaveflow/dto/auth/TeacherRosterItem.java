package com.newaveflow.dto.auth;

import java.util.List;

public record TeacherRosterItem(
        Long id,
        String name,
        String role,
        String phone,
        String birthDate,
        String profileImage,
        String className,
        List<TagInfo> tags,
        String churchPosition
) {
    public record TagInfo(Long id, String name, String category, String color) {}
}
