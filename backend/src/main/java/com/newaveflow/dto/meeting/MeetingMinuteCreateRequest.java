package com.newaveflow.dto.meeting;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;

public record MeetingMinuteCreateRequest(
    String title,
    String content,
    String videoLink,
    @JsonFormat(pattern = "yyyy-MM-dd")
    LocalDate meetingDate,
    @JsonProperty("isActive") boolean isActive
) {}
