package com.newaveflow.dto.event;

import com.newaveflow.entity.Event;
import com.newaveflow.entity.MeetingAttendance;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public class EventDto {

    public record EventResponse(
            Long id,
            String title,
            String description,
            LocalDate eventDate,
            String startTime,
            String endTime,
            String color,
            String eventType
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
                    event.getEventType().name()
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
            @NotNull String eventType
    ) {}

    public record EventAttendanceRequest(
            @NotNull String status
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
