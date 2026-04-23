package com.newaveflow.controller;

import com.newaveflow.dto.event.EventDto.MeetingAttendanceRequest;
import com.newaveflow.dto.event.EventDto.MeetingAttendanceResponse;
import com.newaveflow.entity.User;
import com.newaveflow.service.MeetingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

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
        
        return ResponseEntity.ok(meetingService.saveMeetingAttendance(currentUser.getId(), request));
    }

    @GetMapping("/attendance/admin")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'PASTOR', 'EXECUTIVE')")
    public ResponseEntity<java.util.List<MeetingAttendanceResponse>> getAdminMeetingAttendance(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(meetingService.getAdminMeetingAttendance(date));
    }
}
