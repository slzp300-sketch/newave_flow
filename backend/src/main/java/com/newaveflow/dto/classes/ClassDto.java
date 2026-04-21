package com.newaveflow.dto.classes;

import java.util.List;

public record ClassDto(
        Long id,
        String name,
        String grade,
        String gender,
        String teacherName, // Primary teacher name for backward compatibility/simplicity
        String description,
        List<ClassTeacherDto> teachers,
        List<StudentDto> students
) {
    public static ClassDto from(com.newaveflow.entity.ClassGroup entity) {
        return new ClassDto(
                entity.getId(),
                entity.getName(),
                entity.getAgeGroup(),
                entity.getGender(),
                null,
                entity.getDescription(),
                List.of(),
                List.of()
        );
    }

    public static ClassDto from(com.newaveflow.entity.ClassGroup entity, String teacherName, List<ClassTeacherDto> teachers, List<StudentDto> students) {
        return new ClassDto(
                entity.getId(),
                entity.getName(),
                entity.getAgeGroup(),
                entity.getGender(),
                teacherName,
                entity.getDescription(),
                teachers,
                students
        );
    }
}
