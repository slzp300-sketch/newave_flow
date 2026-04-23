package com.newaveflow.dto.classes;

import java.util.List;

public record TeacherAssignmentRequest(
    List<TeacherAssignment> assignments
) {
    public record TeacherAssignment(
        Long userId,
        boolean isPrimary
    ) {}
}
