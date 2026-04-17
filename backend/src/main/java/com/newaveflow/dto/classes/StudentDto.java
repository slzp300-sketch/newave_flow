package com.newaveflow.dto.classes;

import com.newaveflow.entity.Student;

public record StudentDto(
        Long id,
        String name,
        String grade,
        String parentName,
        String parentPhone
) {
    public static StudentDto from(Student entity) {
        return new StudentDto(
                entity.getId(),
                entity.getName(),
                entity.getGrade(),
                entity.getParentName(),
                entity.getParentPhone()
        );
    }
}
