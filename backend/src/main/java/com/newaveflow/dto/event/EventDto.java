package com.newaveflow.dto.event;

import com.newaveflow.entity.Event;
import com.newaveflow.entity.MeetingAttendance;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

public class EventDto {

    public record EventResponse(
            Long id,
            String title,
            String description,
            LocalDate eventDate,
            String startTime,
            String endTime,
            String color,
            String eventType,
            boolean attendanceRequired
    ) {
        public static EventResponse from(Event event) {
            return new EventResponse(
                    event.getId(),
                    event.getTitle(),
                    event.getDescription(),
                    event.getEventDate(),
                    event.getStartTime(),
                    event.getEndTime(),
                    event.getColor(),
                    event.getEventType().name(),
                    event.isAttendanceRequired()
            );
        }
    }

    public record EventCreateRequest(
            @NotNull String title,
            String description,
            @NotNull LocalDate eventDate,
            String startTime,
            String endTime,
            String color,
            @NotNull String eventType,
            Boolean attendanceRequired
    ) {}

    public record EventAttendanceRequest(
            @NotNull String status
    ) {}

    // 학생 출석 단건
    public record StudentAttendanceItem(
            @NotNull Long studentId,
            @NotNull String status  // PRESENT / ABSENT
    ) {}

    // 배치 요청
    public record StudentAttendanceBatchRequest(
            @NotNull List<StudentAttendanceItem> records
    ) {}

    // 학생 출석 응답 단건
    public record StudentAttendanceRecord(
            Long studentId,
            String studentName,
            String grade,
            Long classGroupId,
            String classGroupName,
            String status  // null = 미제출
    ) {}

    // 반별 출석 요약 (관리자용)
    public record ClassAttendanceSummary(
            Long classGroupId,
            String classGroupName,
            long totalCount,
            long presentCount,
            long absentCount,
            List<StudentAttendanceRecord> records
    ) {}

    public record MeetingAttendanceRequest(
            @NotNull LocalDate meetingDate,
            @NotNull String status
    ) {}

    public record MeetingAttendanceResponse(
            Long teacherId,
            LocalDate meetingDate,
            String status
    ) {
        public static MeetingAttendanceResponse from(MeetingAttendance attendance) {
            if (attendance == null) return new MeetingAttendanceResponse(null, null, null);
            return new MeetingAttendanceResponse(
                    attendance.getTeacher().getId(),
                    attendance.getMeetingDate(),
                    attendance.getStatus()
            );
        }
    }
}
