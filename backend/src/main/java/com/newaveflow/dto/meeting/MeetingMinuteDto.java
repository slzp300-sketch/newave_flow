package com.newaveflow.dto.meeting;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record MeetingMinuteDto(
    Long id,
    String title,
    String content,
    String videoLink,
    @JsonFormat(pattern = "yyyy-MM-dd")
    LocalDate meetingDate,
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    LocalDateTime createdAt,
    boolean confirmed,
    String attendanceStatus,
    boolean isActive
) {}
