package com.newaveflow.dto.classes;

import com.newaveflow.entity.Student;

public record StudentDto(
        Long id,
        String name,
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
        String profileImage,
        boolean isActive,
        boolean hasPendingRequest,
        String prayerRequest,
        String sketch
) {
    public static StudentDto from(Student entity) {
        return from(entity, false, null, null);
    }
    
    public static StudentDto from(Student entity, boolean hasPendingRequest) {
        return from(entity, hasPendingRequest, null, null);
    }

    public static StudentDto from(Student entity, boolean hasPendingRequest, String prayerRequest, String sketch) {
        return new StudentDto(
                entity.getId(),
                entity.getName(),
                entity.getGrade(),
                entity.getGender(),
                entity.getBirthDate() != null ? entity.getBirthDate().toString() : null,
                entity.getSchool(),
                entity.getPhone(),
                entity.getBaptism(),
                entity.getFatherName(),
                entity.getFatherPhone(),
                entity.getMotherName(),
                entity.getMotherPhone(),
                entity.getAddress(),
                entity.getProfileImage(),
                entity.isActive(),
                hasPendingRequest,
                prayerRequest,
                sketch
        );
    }
}
