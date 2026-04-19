package com.newaveflow.dto.classes;

import java.util.List;

public record ClassDto(
        Long id,
        String name,
        String grade,
        String gender,
        String teacherName,
        String description,
        List<StudentDto> students
) {
    public static ClassDto from(com.newaveflow.entity.ClassGroup entity) {
        return new ClassDto(
                entity.getId(),
                entity.getName(),
                entity.getAgeGroup(),
                entity.getGender(),
                null, // teacherName can be filled by service
                entity.getDescription(),
                List.of()
        );
    }

    public static ClassDto from(com.newaveflow.entity.ClassGroup entity, String teacherName, List<StudentDto> students) {
        return new ClassDto(
                entity.getId(),
                entity.getName(),
                entity.getAgeGroup(),
                entity.getGender(),
                teacherName,
                entity.getDescription(),
                students
        );
    }
}
