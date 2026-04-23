package com.newaveflow.controller;

import com.newaveflow.dto.meeting.MeetingMinuteCreateRequest;
import com.newaveflow.dto.meeting.MeetingMinuteDto;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import com.newaveflow.service.NotificationService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/minutes")
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class MeetingMinuteController {

    private final MeetingMinuteRepository meetingMinuteRepository;
    private final MeetingMinuteConfirmRepository meetingMinuteConfirmRepository;
    private final MeetingAttendanceRepository meetingAttendanceRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<List<MeetingMinuteDto>> getAll(@AuthenticationPrincipal User currentUser) {
        boolean isAdmin = currentUser.getRole() == User.Role.PASTOR || 
                          currentUser.getRole() == User.Role.EXECUTIVE || 
                          currentUser.getRole() == User.Role.ADMIN;
        
        List<MeetingMinute> minutes = isAdmin 
            ? meetingMinuteRepository.findAllByOrderByMeetingDateDesc()
            : meetingMinuteRepository.findAllByIsActiveTrueOrderByMeetingDateDesc();
        
        List<MeetingMinuteDto> dtos = minutes.stream().map(m -> {
            boolean confirmed = meetingMinuteConfirmRepository.findByMinutesAndUser(m, currentUser).isPresent();
            
            MeetingAttendance attendance = meetingAttendanceRepository.findByTeacherIdAndMeetingDate(currentUser.getId(), m.getMeetingDate())
                .orElse(null);
            String attendanceStatus = (attendance != null) ? attendance.getStatus() : "UNKNOWN";

            return new MeetingMinuteDto(
                m.getId(), m.getTitle(), m.getContent(), m.getVideoLink(),
                m.getMeetingDate(), m.getCreatedAt(), confirmed, attendanceStatus, m.isActive()
            );
        }).toList();
        
        return ResponseEntity.ok(dtos);
    }

    @PostMapping
    public ResponseEntity<MeetingMinute> create(@RequestBody MeetingMinuteCreateRequest request) {
        log.debug("Creating meeting minutes: {}", request);
        MeetingMinute minutes = MeetingMinute.builder()
            .title(request.title())
            .content(request.content())
            .videoLink(request.videoLink())
            .meetingDate(request.meetingDate())
            .isActive(request.isActive())
            .build();
        MeetingMinute saved = meetingMinuteRepository.save(minutes);
        
        if (saved.isActive()) {
            List<Long> activeUserIds = userRepository.findByIsActiveTrue().stream().map(User::getId).toList();
            notificationService.createNotificationForUsers(activeUserIds, 
                "새로운 회의록", 
                "새로운 교사 회의록이 등록되었습니다.", 
                Notification.NotificationType.MINUTE);
        }

        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<MeetingMinute> update(@PathVariable Long id, @RequestBody MeetingMinuteCreateRequest request) {
        MeetingMinute minutes = meetingMinuteRepository.findById(id).orElseThrow();
        minutes.setTitle(request.title());
        minutes.setContent(request.content());
        minutes.setVideoLink(request.videoLink());
        minutes.setMeetingDate(request.meetingDate());
        minutes.setActive(request.isActive());
        return ResponseEntity.ok(meetingMinuteRepository.save(minutes));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        meetingMinuteConfirmRepository.deleteAllByMinutesId(id);
        meetingMinuteRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<Void> confirm(@PathVariable Long id, @AuthenticationPrincipal User currentUser) {
        MeetingMinute minutes = meetingMinuteRepository.findById(id).orElseThrow();
        
        if (meetingMinuteConfirmRepository.findByMinutesAndUser(minutes, currentUser).isEmpty()) {
            meetingMinuteConfirmRepository.save(MeetingMinuteConfirm.builder()
                .minutes(minutes)
                .user(currentUser)
                .build());
        }
        
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/status")
    public ResponseEntity<List<Map<String, Object>>> getStatus(@PathVariable Long id) {
        MeetingMinute minutes = meetingMinuteRepository.findById(id).orElseThrow();
        List<User> teachers = userRepository.findByRoleAndIsActiveTrue(User.Role.TEACHER);
        
        List<MeetingMinuteConfirm> confirms = meetingMinuteConfirmRepository.findAllByMinutes(minutes);
        Map<Long, MeetingMinuteConfirm> confirmMap = confirms.stream()
            .collect(Collectors.toMap(c -> c.getUser().getId(), c -> c));
        
        List<Map<String, Object>> result = teachers.stream().map(t -> {
            MeetingAttendance attendance = meetingAttendanceRepository.findByTeacherIdAndMeetingDate(t.getId(), minutes.getMeetingDate())
                .orElse(null);
            
            String attendanceStatus = (attendance != null) ? attendance.getStatus() : "UNKNOWN";
            String attendanceReason = (attendance != null) ? attendance.getReason() : "";
            boolean confirmed = confirmMap.containsKey(t.getId());
            
            Map<String, Object> statusMap = new HashMap<>();
            statusMap.put("teacherId", t.getId());
            statusMap.put("teacherName", t.getName());
            statusMap.put("teacherGrade", t.getGrade());
            statusMap.put("attendanceStatus", attendanceStatus);
            statusMap.put("attendanceReason", attendanceReason);
            statusMap.put("confirmed", confirmed);
            statusMap.put("confirmedAt", confirmed ? confirmMap.get(t.getId()).getConfirmedAt() : "");
            
            return statusMap;
        }).toList();
        
        return ResponseEntity.ok(result);
    }
}
