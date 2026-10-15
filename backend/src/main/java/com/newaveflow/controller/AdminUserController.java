package com.newaveflow.controller;

import com.newaveflow.dto.UserApprovalRequest;
import com.newaveflow.dto.auth.LoginResponse.UserInfo;
import com.newaveflow.service.AdminUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'PASTOR', 'EXECUTIVE')")
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService adminUserService;
    private final com.newaveflow.service.AuthService authService;

    public record PasswordResetRequest(boolean identityVerified) {}

    @PostMapping("/{id}/reset-password")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<com.newaveflow.dto.auth.ResetPasswordResponse> resetPassword(
            @PathVariable Long id, @RequestBody PasswordResetRequest request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.newaveflow.entity.User user) {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
                .body(authService.resetPasswordByAdmin(id, user, request.identityVerified()));
    }

    @GetMapping("/pending")
    public ResponseEntity<List<UserInfo>> getPendingUsers() {
        return ResponseEntity.ok(adminUserService.getPendingUsers());
    }

    @PatchMapping("/{id}/approve")
    public ResponseEntity<Void> approveUser(@PathVariable Long id, @RequestBody UserApprovalRequest request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.newaveflow.entity.User actor) {
        adminUserService.approveUser(actor, id, request);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/suspended")
    public ResponseEntity<List<AdminUserService.SuspendedUser>> getSuspendedUsers() {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore()).body(adminUserService.getSuspendedUsers());
    }

    @GetMapping("/{id}/status-history")
    public ResponseEntity<List<AdminUserService.StatusHistory>> statusHistory(@PathVariable Long id) {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore()).body(adminUserService.statusHistory(id));
    }

    public record RestoreRequest(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 2000) String reason,
                                 @jakarta.validation.constraints.NotNull @jakarta.validation.constraints.PositiveOrZero Long expectedAuthVersion) {}

    @PatchMapping("/{id}/restore")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> restore(@PathVariable Long id, @jakarta.validation.Valid @RequestBody RestoreRequest request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.newaveflow.entity.User actor) {
        adminUserService.restoreUser(actor, id, request.reason(), request.expectedAuthVersion());
        return ResponseEntity.ok().build();
    }
}
