package com.newaveflow.dto.classes;

import com.newaveflow.entity.DeactivationRequest;

import java.time.format.DateTimeFormatter;

public class DeactivationRequestDto {

    public record CreateRequest(String reason) {}

    public record Response(
            Long id,
            Long studentId,
            String studentName,
            String studentGrade,
            String classGroupName,
            String teacherName,
            String reason,
            String status,
            String requestedAt
    ) {
        private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

        public static Response from(DeactivationRequest r) {
            return new Response(
                    r.getId(),
                    r.getStudent().getId(),
                    r.getStudent().getName(),
                    r.getStudent().getGrade(),
                    r.getStudent().getClassGroup().getName(),
                    r.getTeacher().getName(),
                    r.getReason(),
                    r.getStatus().name(),
                    r.getRequestedAt() != null ? r.getRequestedAt().format(FMT) : null
            );
        }
    }
}
