package com.newaveflow.dto.classes;

import com.newaveflow.entity.Student;

public record AdminStudentDto(
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
        Long classGroupId,
        String classGroupName
) {
    public static AdminStudentDto from(Student entity) {
        return new AdminStudentDto(
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
                entity.getClassGroup() != null ? entity.getClassGroup().getId() : null,
                entity.getClassGroup() != null ? entity.getClassGroup().getName() : null
        );
    }
}
