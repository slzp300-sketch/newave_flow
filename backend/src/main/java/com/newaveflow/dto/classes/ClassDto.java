package com.newaveflow.dto.classes;

import com.newaveflow.entity.ClassGroup;

public record ClassDto(
        Long id,
        String name,
        String ageGroup,
        String description
) {
    public static ClassDto from(ClassGroup entity) {
        return new ClassDto(
                entity.getId(),
                entity.getName(),
                entity.getAgeGroup(),
                entity.getDescription()
        );
    }
}
