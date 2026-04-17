package com.newaveflow.dto.attendance;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public record AttendanceBatchRequest(
        @NotNull(message = "반 ID는 필수입니다.")
        Long classGroupId,

        @NotNull(message = "출석 날짜는 필수입니다.")
        LocalDate attendanceDate,

        @NotEmpty(message = "출석 기록은 하나 이상이어야 합니다.")
        List<Record> records
) {
    public record Record(
            @NotNull Long studentId,
            @NotNull String status,
            String note
    ) {}
}
