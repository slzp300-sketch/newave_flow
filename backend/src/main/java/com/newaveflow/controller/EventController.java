package com.newaveflow.controller;

import com.newaveflow.dto.event.EventDto;
import com.newaveflow.entity.User;
import com.newaveflow.service.EventService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    @GetMapping
    public ResponseEntity<List<EventDto.EventResponse>> getEvents(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(eventService.getEvents(from, to));
    }

    @GetMapping("/all")
    public ResponseEntity<List<EventDto.EventResponse>> getAllEvents() {
        return ResponseEntity.ok(eventService.getAllEvents());
    }

    @GetMapping("/attendance-required")
    public ResponseEntity<List<EventDto.EventResponse>> getAttendanceRequiredEvents() {
        return ResponseEntity.ok(eventService.getAttendanceRequiredEvents());
    }

    @GetMapping("/{id}")
    public ResponseEntity<EventDto.EventResponse> getEvent(@PathVariable Long id) {
        return ResponseEntity.ok(eventService.getEvent(id));
    }

    @PostMapping
    public ResponseEntity<EventDto.EventResponse> createEvent(@Valid @RequestBody EventDto.EventCreateRequest request) {
        return ResponseEntity.ok(eventService.createEvent(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<EventDto.EventResponse> updateEvent(
            @PathVariable Long id,
            @Valid @RequestBody EventDto.EventCreateRequest request) {
        return ResponseEntity.ok(eventService.updateEvent(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEvent(@PathVariable Long id) {
        eventService.deleteEvent(id);
        return ResponseEntity.noContent().build();
    }

    // 교사: 내 반 학생 출석 현황 조회
    @GetMapping("/{id}/student-attendance")
    public ResponseEntity<List<EventDto.StudentAttendanceRecord>> getMyClassAttendance(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(eventService.getMyClassAttendance(id, currentUser.getId()));
    }

    // 교사: 내 반 학생 출석 배치 제출
    @PostMapping("/{id}/student-attendance/batch")
    public ResponseEntity<Void> saveStudentAttendanceBatch(
            @PathVariable Long id,
            @Valid @RequestBody EventDto.StudentAttendanceBatchRequest request,
            @AuthenticationPrincipal User currentUser) {
        eventService.saveStudentAttendanceBatch(id, currentUser.getId(), request.records());
        return ResponseEntity.ok().build();
    }

    // 관리자: 행사별 전체 출석 요약 조회
    @GetMapping("/{id}/student-attendance/summary")
    @PreAuthorize("hasAnyRole('ADMIN', 'PASTOR', 'EXECUTIVE')")
    public ResponseEntity<List<EventDto.ClassAttendanceSummary>> getStudentAttendanceSummary(
            @PathVariable Long id) {
        return ResponseEntity.ok(eventService.getStudentAttendanceSummary(id));
    }

    // 교사: 내 출석 조회
    @GetMapping("/{id}/teacher-attendance")
    public ResponseEntity<EventDto.TeacherAttendanceStatusResponse> getMyTeacherAttendance(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(eventService.getMyTeacherAttendance(id, currentUser.getId()));
    }

    // 교사: 내 출석 제출/수정
    @PostMapping("/{id}/teacher-attendance")
    public ResponseEntity<Void> saveTeacherAttendance(
            @PathVariable Long id,
            @RequestBody EventDto.EventAttendanceRequest request,
            @AuthenticationPrincipal User currentUser) {
        eventService.saveTeacherAttendance(id, currentUser.getId(),
                request.status(), request.partialFromDate(), request.partialNote(), request.absenceReason());
        return ResponseEntity.ok().build();
    }

    // 관리자: 교사 출석 요약 조회
    @GetMapping("/{id}/teacher-attendance/summary")
    @PreAuthorize("hasAnyRole('ADMIN', 'PASTOR', 'EXECUTIVE')")
    public ResponseEntity<List<EventDto.TeacherAttendanceRecord>> getTeacherAttendanceSummary(
            @PathVariable Long id) {
        return ResponseEntity.ok(eventService.getTeacherAttendanceSummary(id));
    }
}
