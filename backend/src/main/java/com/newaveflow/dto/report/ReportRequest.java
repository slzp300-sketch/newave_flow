package com.newaveflow.dto.report;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record ReportRequest(
        @NotNull(message = "반 ID는 필수입니다.")
        Long classGroupId,

        @NotNull(message = "보고 날짜는 필수입니다.")
        LocalDate reportDate,

        String specialNotes
) {}
