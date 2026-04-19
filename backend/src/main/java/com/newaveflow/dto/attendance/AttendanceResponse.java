package com.newaveflow.dto.attendance;

import com.newaveflow.entity.Attendance;

import java.time.LocalDate;

public record AttendanceResponse(
        Long studentId,
        String studentName,
        LocalDate attendanceDate,
        String status,
        String absentReason,
        String note
) {
    public static AttendanceResponse from(Attendance a) {
        return new AttendanceResponse(
                a.getStudent().getId(),
                a.getStudent().getName(),
                a.getAttendanceDate(),
                a.getStatus().name(),
                a.getAbsentReason(),
                a.getNote()
        );
    }
}
