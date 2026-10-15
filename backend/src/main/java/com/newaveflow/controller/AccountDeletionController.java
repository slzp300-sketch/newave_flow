package com.newaveflow.controller;

import com.newaveflow.entity.User;
import com.newaveflow.service.AccountDeletionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor
public class AccountDeletionController {
    private final AccountDeletionService deletion;
    @GetMapping("/api/account-deletion")
    public ResponseEntity<AccountDeletionService.View> current(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(deletion.current(user));
    }
    @PostMapping("/api/account-deletion")
    public ResponseEntity<AccountDeletionService.Receipt> submit(@AuthenticationPrincipal User user,
            @Valid @RequestBody AccountDeletionService.SubmitRequest input) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(deletion.submit(user, input));
    }
    // A receipt is a 256-bit capability sent in the body, never in URLs, referrers, or server access logs.
    @PostMapping("/api/auth/account-deletion/status")
    public ResponseEntity<AccountDeletionService.View> status(@Valid @RequestBody AccountDeletionService.StatusRequest input) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(deletion.status(input.receiptToken()));
    }
}
