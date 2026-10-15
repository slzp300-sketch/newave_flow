package com.newaveflow.controller;

import com.newaveflow.service.AppleNotificationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor
public class AppleNotificationController {
    private final AppleNotificationService service;
    public record Notification(@NotBlank @Size(max=16384) String payload) {}
    @PostMapping(value="/api/auth/apple/notifications", consumes=MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Void> receive(@Valid @RequestBody Notification request) {
        service.receive(request.payload());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).build();
    }
}
