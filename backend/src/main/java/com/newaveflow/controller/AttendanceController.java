package com.newaveflow.controller;

import com.newaveflow.dto.attendance.AttendanceBatchRequest;
import com.newaveflow.dto.attendance.AttendanceResponse;
import com.newaveflow.entity.User;
import com.newaveflow.service.AttendanceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceService attendanceService;

    @GetMapping
    public ResponseEntity<List<AttendanceResponse>> getAttendance(
            @RequestParam Long classId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(attendanceService.getByClassAndDate(classId, date));
    }

    @PostMapping("/batch")
    public ResponseEntity<Map<String, Object>> saveBatch(
            @Valid @RequestBody AttendanceBatchRequest request,
            @AuthenticationPrincipal User currentUser) {
        int saved = attendanceService.saveBatch(request, currentUser.getId());
        return ResponseEntity.ok(Map.of("saved", saved, "date", request.attendanceDate()));
    }

    @GetMapping("/student/{studentId}")
    public ResponseEntity<List<AttendanceResponse>> getStudentHistory(@PathVariable Long studentId) {
        return ResponseEntity.ok(attendanceService.getStudentAttendanceHistory(studentId));
    }
}
