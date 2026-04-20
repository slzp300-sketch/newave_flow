package com.newaveflow.dto.classes;

import jakarta.validation.constraints.NotBlank;

public record StudentUpdateRequest(
        @NotBlank String name,
        String gender,
        String birthDate,
        String school,
        String phone,
        Boolean baptism,
        String fatherName,
        String fatherPhone,
        String motherName,
        String motherPhone,
        String address
) {}
