package com.newaveflow.dto.classes;

public record StudentCreateRequest(
        String name,
        Long classGroupId,
        String grade,
        String gender,
        String birthDate,
        String school,
        String phone,
        Boolean baptism,
        String fatherName,
        String fatherPhone,
        String motherName,
        String motherPhone,
        String address,
        String profileImage
) {}
