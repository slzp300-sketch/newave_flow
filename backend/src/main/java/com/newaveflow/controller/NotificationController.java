package com.newaveflow.controller;

import com.newaveflow.dto.NotificationResponse;
import com.newaveflow.entity.User;
import com.newaveflow.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final com.newaveflow.service.PushDeviceService devices;

    @PutMapping("/devices/{installationId}")
    public ResponseEntity<Void> registerDevice(@PathVariable String installationId,
            @RequestBody com.newaveflow.service.PushDeviceService.Registration body, @AuthenticationPrincipal User user) {
        devices.register(user.getId(), installationId, body); return ResponseEntity.noContent().build();
    }
    @DeleteMapping("/devices/{installationId}")
    public ResponseEntity<Void> unregisterDevice(@PathVariable String installationId, @AuthenticationPrincipal User user) {
        devices.unregister(user.getId(), installationId); return ResponseEntity.noContent().build();
    }
    @GetMapping("/preferences")
    public com.newaveflow.service.PushDeviceService.Preference preferences(@AuthenticationPrincipal User user,
            @RequestParam(required=false) String platform) {
        return devices.preference(user.getId(),platform);
    }
    @PutMapping("/preferences")
    public com.newaveflow.service.PushDeviceService.Preference preferences(@RequestBody com.newaveflow.service.PushDeviceService.PreferenceRequest body,
            @AuthenticationPrincipal User user,@RequestParam(required=false) String platform) {
        if(body.pushEnabled()==null) throw com.newaveflow.exception.AppException.badRequest("알림 수신 여부를 선택해주세요.");
        devices.preference(user.getId(),platform); // Validate the platform before mutating preferences.
        devices.preference(user.getId(),body.pushEnabled());
        return devices.preference(user.getId(),platform);
    }

    @GetMapping
    public ResponseEntity<List<NotificationResponse>> getMyNotifications(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(notificationService.getMyNotifications(user.getId()));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Integer> getUnreadCount(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(notificationService.getUnreadCount(user.getId()));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable Long id, @AuthenticationPrincipal User user) {
        notificationService.markAsRead(id, user.getId());
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/read-all")
    public ResponseEntity<Void> markAllAsRead(@AuthenticationPrincipal User user) {
        notificationService.markAllAsRead(user.getId());
        return ResponseEntity.ok().build();
    }
}
