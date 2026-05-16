package com.newaveflow.dto.attendance;

public class AdminWeeklyAttendanceDto {

    public record ClassSummary(
            Long classGroupId,
            String classGroupName,
            String ageGroup,
            int totalStudents,
            int presentCount,
            int absentCount,
            boolean submitted,
            String teacherName
    ) {}

    public record AbsentStudent(
            String ageGroup,
            String classGroupName,
            String studentName,
            String status,
            String absentReason
    ) {}
}
