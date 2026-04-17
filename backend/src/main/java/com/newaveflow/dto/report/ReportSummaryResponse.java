package com.newaveflow.dto.report;

import java.time.LocalDate;
import java.util.List;

public record ReportSummaryResponse(
        LocalDate date,
        int totalTeachers,
        long submitted,
        long notSubmittedCount,
        List<NotSubmittedTeacher> notSubmitted
) {
    public record NotSubmittedTeacher(Long teacherId, String teacherName, String className) {}
}
