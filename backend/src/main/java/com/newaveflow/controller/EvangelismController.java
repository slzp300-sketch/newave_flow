package com.newaveflow.controller;

import com.newaveflow.dto.evangelism.EvangelismDto.*;
import com.newaveflow.entity.User;
import com.newaveflow.service.EvangelismService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/evangelism")
@RequiredArgsConstructor
public class EvangelismController {

    private final EvangelismService evangelismService;

    // ── 조 ──

    @GetMapping("/groups")
    public ResponseEntity<List<GroupResponse>> getGroups() {
        return ResponseEntity.ok(evangelismService.getAllGroups());
    }

    @PostMapping("/groups")
    public ResponseEntity<GroupResponse> createGroup(@RequestBody GroupRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(evangelismService.createGroup(req));
    }

    @PutMapping("/groups/{groupId}")
    public ResponseEntity<GroupResponse> updateGroup(
            @PathVariable Long groupId,
            @RequestBody GroupRequest req) {
        return ResponseEntity.ok(evangelismService.updateGroup(groupId, req));
    }

    @PutMapping("/groups/{groupId}/members")
    public ResponseEntity<GroupResponse> updateGroupMembers(
            @PathVariable Long groupId,
            @RequestBody GroupMembersRequest req) {
        return ResponseEntity.ok(evangelismService.updateGroupMembers(groupId, req));
    }

    @DeleteMapping("/groups/{groupId}")
    public ResponseEntity<Void> deleteGroup(@PathVariable Long groupId) {
        evangelismService.deleteGroup(groupId);
        return ResponseEntity.noContent().build();
    }

    // ── 일정 ──

    @GetMapping("/schedules")
    public ResponseEntity<List<ScheduleResponse>> getSchedules(
            @RequestParam(defaultValue = "false") boolean upcomingOnly) {
        List<ScheduleResponse> result = upcomingOnly
            ? evangelismService.getUpcomingSchedules()
            : evangelismService.getAllSchedules();
        return ResponseEntity.ok(result);
    }

    @PostMapping("/schedules")
    public ResponseEntity<ScheduleResponse> createSchedule(@RequestBody ScheduleRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(evangelismService.createSchedule(req));
    }

    @PutMapping("/schedules/{scheduleId}")
    public ResponseEntity<ScheduleResponse> updateSchedule(
            @PathVariable Long scheduleId,
            @RequestBody ScheduleRequest req) {
        return ResponseEntity.ok(evangelismService.updateSchedule(scheduleId, req));
    }

    @DeleteMapping("/schedules/{scheduleId}")
    public ResponseEntity<Void> deleteSchedule(@PathVariable Long scheduleId) {
        evangelismService.deleteSchedule(scheduleId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/schedules/{scheduleId}/cancel")
    public ResponseEntity<ScheduleResponse> cancelSchedule(@PathVariable Long scheduleId) {
        return ResponseEntity.ok(evangelismService.cancelSchedule(scheduleId));
    }

    // ── 내 상태 / 일정 (교사용) ──

    @GetMapping("/status/mine")
    public ResponseEntity<MyStatusResponse> getMyStatus(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(evangelismService.getMyStatus(currentUser.getId()));
    }

    @GetMapping("/schedules/mine")
    public ResponseEntity<List<ScheduleResponse>> getMySchedules(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(evangelismService.getMySchedules(currentUser.getId()));
    }
}
