package com.newaveflow.controller;

import com.newaveflow.dto.classes.DeactivationRequestDto;
import com.newaveflow.entity.User;
import com.newaveflow.service.DeactivationRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class DeactivationRequestController {

    private final DeactivationRequestService deactivationRequestService;

    // 교사: 제적 신청 (사유 포함)
    @PostMapping("/api/students/{studentId}/deactivation-request")
    public ResponseEntity<DeactivationRequestDto.Response> createRequest(
            @PathVariable Long studentId,
            @RequestBody DeactivationRequestDto.CreateRequest body,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(deactivationRequestService.createRequest(studentId, body.reason(), currentUser));
    }

    // 관리자: 대기 중인 제적 신청 목록
    @GetMapping("/api/admin/deactivation-requests")
    public ResponseEntity<List<DeactivationRequestDto.Response>> getPending() {
        return ResponseEntity.ok(deactivationRequestService.getPendingRequests());
    }

    // 관리자: 승인
    @PatchMapping("/api/admin/deactivation-requests/{id}/approve")
    public ResponseEntity<DeactivationRequestDto.Response> approve(@PathVariable Long id) {
        return ResponseEntity.ok(deactivationRequestService.approve(id));
    }

    // 관리자: 반려
    @PatchMapping("/api/admin/deactivation-requests/{id}/reject")
    public ResponseEntity<DeactivationRequestDto.Response> reject(@PathVariable Long id) {
        return ResponseEntity.ok(deactivationRequestService.reject(id));
    }
}
