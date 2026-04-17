package com.newaveflow.dto.evangelism;

import com.newaveflow.entity.EvangelismAssignment;
import com.newaveflow.entity.EvangelismGroup;
import com.newaveflow.entity.EvangelismGroupMember;
import com.newaveflow.entity.EvangelismSchedule;

import java.time.LocalDate;
import java.util.List;

public class EvangelismDto {

    // ── Request ──

    public record GroupRequest(String name) {}

    public record GroupMembersRequest(List<Long> teacherIds) {}

    public record ScheduleRequest(
        LocalDate scheduledDate,
        List<Long> teacherIds,
        Long groupId
    ) {}

    // ── Response ──

    public record MemberResponse(Long id, Long teacherId, String teacherName) {
        public static MemberResponse from(EvangelismGroupMember m) {
            return new MemberResponse(m.getId(), m.getTeacher().getId(), m.getTeacher().getName());
        }
    }

    public record GroupResponse(Long id, String name, List<MemberResponse> members) {
        public static GroupResponse from(EvangelismGroup g) {
            List<MemberResponse> members = g.getMembers().stream()
                .map(MemberResponse::from)
                .toList();
            return new GroupResponse(g.getId(), g.getName(), members);
        }
    }

    public record AssignmentResponse(Long id, Long teacherId, String teacherName, Long groupId, String groupName) {
        public static AssignmentResponse from(EvangelismAssignment a) {
            return new AssignmentResponse(
                a.getId(),
                a.getTeacher().getId(),
                a.getTeacher().getName(),
                a.getGroup() != null ? a.getGroup().getId() : null,
                a.getGroup() != null ? a.getGroup().getName() : "소속 없음"
            );
        }
    }

    public record ScheduleResponse(
        Long id,
        LocalDate scheduledDate,
        String status,
        List<AssignmentResponse> assignments
    ) {
        public static ScheduleResponse from(EvangelismSchedule s) {
            String status = s.getStatus();
            if ("ACTIVE".equals(status)) {
                status = resolveStatus(s.getScheduledDate());
            }
            List<AssignmentResponse> assignments = s.getAssignments().stream()
                .map(AssignmentResponse::from)
                .toList();
            return new ScheduleResponse(s.getId(), s.getScheduledDate(), status, assignments);
        }

        private static String resolveStatus(LocalDate date) {
            LocalDate today = LocalDate.now();
            if (date.isBefore(today)) return "COMPLETED";
            if (!date.isAfter(today.plusDays(7))) return "ACTIVE";
            return "UPCOMING";
        }
    }

    public record MyStatusResponse(
        GroupResponse myGroup,
        ScheduleResponse nextSchedule,
        List<ScheduleResponse> upcomingSchedules
    ) {}
}
