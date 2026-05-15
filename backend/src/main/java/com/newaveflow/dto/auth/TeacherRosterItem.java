package com.newaveflow.dto.auth;

public record TeacherRosterItem(
        Long id,
        String name,
        String role,
        String phone,
        String birthDate,
        String profileImage,
        String className,
        String positionTitle
) {}
