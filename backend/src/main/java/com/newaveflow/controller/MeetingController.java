package com.newaveflow.controller;

import com.newaveflow.dto.event.EventDto.MeetingAttendanceRequest;
import com.newaveflow.dto.event.EventDto.MeetingAttendanceResponse;
import com.newaveflow.entity.User;
import com.newaveflow.exception.AppException;
import com.newaveflow.service.MeetingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/meetings")
@RequiredArgsConstructor
public class MeetingController {

    private final MeetingService meetingService;

    @GetMapping("/attendance")
    public ResponseEntity<MeetingAttendanceResponse> getMeetingAttendance(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @AuthenticationPrincipal User currentUser) {
        
        LocalDate targetDate = (date != null) ? date : LocalDate.now();
        return ResponseEntity.ok(meetingService.getMeetingAttendance(currentUser.getId(), targetDate));
    }

    @PostMapping("/attendance")
    public ResponseEntity<MeetingAttendanceResponse> saveMeetingAttendance(
            @Valid @RequestBody MeetingAttendanceRequest request,
            @AuthenticationPrincipal User currentUser) {

        LocalDateTime now = LocalDateTime.now();
        if (!MeetingService.isMeetingWindowOpen(now)) {
            throw AppException.forbidden("제출 기간이 아닙니다. 토요회의 참석 여부는 월~토요일 정오까지 제출할 수 있습니다.");
        }

        LocalDate expectedSaturday = MeetingService.getThisWeekSaturday(now.toLocalDate());
        if (!request.meetingDate().equals(expectedSaturday)) {
            throw AppException.forbidden("이번 주 토요회의 날짜로만 제출할 수 있습니다.");
        }

        return ResponseEntity.ok(meetingService.saveMeetingAttendance(currentUser.getId(), request));
    }

    @GetMapping("/attendance/admin")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'PASTOR', 'EXECUTIVE')")
    public ResponseEntity<java.util.List<MeetingAttendanceResponse>> getAdminMeetingAttendance(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(meetingService.getAdminMeetingAttendance(date));
    }
}
