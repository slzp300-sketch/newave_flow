package com.newaveflow.controller;

import com.newaveflow.dto.UserApprovalRequest;
import com.newaveflow.dto.auth.LoginResponse.UserInfo;
import com.newaveflow.service.AdminUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping("/pending")
    public ResponseEntity<List<UserInfo>> getPendingUsers() {
        return ResponseEntity.ok(adminUserService.getPendingUsers());
    }

    @PatchMapping("/{id}/approve")
    public ResponseEntity<Void> approveUser(@PathVariable Long id, @RequestBody UserApprovalRequest request) {
        adminUserService.approveUser(id, request);
        return ResponseEntity.ok().build();
    }
}
