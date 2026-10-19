package com.newaveflow.service;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;

@Service @RequiredArgsConstructor
public class PushDeliveryService {
    private final PushDeliveryRepository deliveries;
    private final PushDeviceRepository devices;
    private final NotificationRepository notifications;
    private final NotificationPreferenceRepository preferences;
    private final UserRepository users;
    private final PushTransport transport;
    private final NotificationEligibilityService eligibility;
    @Value("${PUSH_ENABLED:false}") private boolean enabled;
    @Value("${NOTIFICATIONS_ENABLED:false}") private boolean notificationsEnabled;

    @Transactional
    public void deliver(Long id,Instant now) {
        if(!enabled || !notificationsEnabled || !transport.available()) return;
        var candidate=deliveries.findById(id).orElse(null);
        if(candidate==null) return;
        var notification=notifications.findById(candidate.getNotificationId()).orElse(null);
        if(notification==null) return;
        var user=users.lockById(notification.getUser().getId()).orElse(null);
        var delivery=deliveries.lockById(id).orElse(null);
        if(delivery==null || !"PENDING".equals(delivery.getStatus()) || delivery.getNextAttemptAt().isAfter(now)) return;
        var device=devices.lockById(delivery.getInstallationId()).orElse(null);
        if(!delivery.getExpiresAt().isAfter(now) || user==null || !user.isActive() || user.isSuspended()
                || device==null || !device.isActive() || !device.getUserId().equals(user.getId())
                || !preferences.findById(user.getId()).map(p -> p.isPushEnabled()).orElse(false)
                || !eligibility.relevant(notification,user,now.atZone(java.time.ZoneId.of("Asia/Seoul")).toLocalDate())) {
            delivery.setStatus("CANCELED"); return;
        }
        PushTransport.Result result;
        try { result=transport.send(device,notification); } catch(Exception ignored) { result=PushTransport.Result.RETRY; }
        if(result==PushTransport.Result.DISABLED) return;
        delivery.setAttempts(delivery.getAttempts()+1);
        switch(result) {
            case SENT -> delivery.setStatus("SENT");
            case INVALID_DEVICE -> {
                // Provider-confirmed invalid token cannot be reused; erase it and all queued device deliveries.
                deliveries.deleteByInstallationId(device.getInstallationId()); devices.delete(device);
            }
            case FAILED -> delivery.setStatus("FAILED");
            default -> {
                if(delivery.getAttempts()>=5) delivery.setStatus("FAILED");
                else delivery.setNextAttemptAt(now.plusSeconds(Math.min(3600,60L << delivery.getAttempts())));
            }
        }
    }
}
