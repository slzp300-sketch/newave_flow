package com.newaveflow.service;

import com.newaveflow.dto.NotificationResponse;
import com.newaveflow.entity.Notification;
import com.newaveflow.entity.User;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.NotificationRepository;
import com.newaveflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NotificationService {
    
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final com.newaveflow.repository.PushDeviceRepository devices;
    private final com.newaveflow.repository.PushDeliveryRepository deliveries;
    private final com.newaveflow.repository.NotificationPreferenceRepository preferences;
    private final PushTransport transport;
    @Value("${PUSH_ENABLED:false}") private boolean pushEnabled;

    // 알림 전체 on/off — 점검·개선 전까지 꺼둠. 다시 켜려면 환경변수 NOTIFICATIONS_ENABLED=true
    @Value("${NOTIFICATIONS_ENABLED:false}")
    private boolean notificationsEnabled;

    @Transactional
    public void createNotification(Long userId, String title, String content, Notification.NotificationType type) {
        enqueue(userId,"legacy:"+java.util.UUID.randomUUID(),title,content,type,"/notifications");
    }

    @Transactional
    public void enqueue(Long userId, String key, String title, String content, Notification.NotificationType type, String targetPath) {
        if (!notificationsEnabled) return;
        User user = userRepository.lockById(userId).orElse(null);
        if(user==null || !user.isActive() || user.isSuspended() || notificationRepository.existsByUserIdAndDedupeKey(userId,key)) return;
        if(key==null || key.length()>180 || !safePath(targetPath)) throw new IllegalArgumentException("Invalid notification identity");
        Notification notification = Notification.builder()
                .user(user)
                .title(title)
                .content(content)
                .type(type)
                .dedupeKey(key).targetPath(targetPath)
                .build();
        notificationRepository.save(notification);
        if(pushEnabled && preferences.findById(userId).map(com.newaveflow.entity.NotificationPreference::isPushEnabled).orElse(false)) {
            for(var device:devices.findByUserIdAndActiveTrue(userId)) {
                if(!transport.available(device.getPlatform())) continue;
                var delivery=new com.newaveflow.entity.PushDelivery();
                delivery.setNotificationId(notification.getId()); delivery.setInstallationId(device.getInstallationId());
                delivery.setNextAttemptAt(java.time.Instant.now()); delivery.setExpiresAt(java.time.Instant.now().plusSeconds(86400));
                deliveries.save(delivery);
            }
        }
    }

    public static boolean safePath(String path) {
        return path!=null && (java.util.Set.of("/calendar","/tts","/attendance","/meeting/sat","/minutes","/evangelism","/notifications").contains(path)
                || path.matches("/event-attendance/[1-9][0-9]*"));
    }
    
    @Transactional
    public void createNotificationForUsers(List<Long> userIds, String title, String content, Notification.NotificationType type) {
        if (!notificationsEnabled) return;
        userIds.forEach(id -> createNotification(id, title, content, type));
    }

    public List<NotificationResponse> getMyNotifications(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(NotificationResponse::new)
                .toList();
    }

    public int getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    @Transactional
    public void markAsRead(Long notificationId, Long userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> AppException.notFound("알림을 찾을 수 없습니다."));
        
        if (!notification.getUser().getId().equals(userId)) {
            throw AppException.unauthorized("권한이 없습니다.");
        }
        
        notification.markAsRead();
    }
    
    @Transactional
    public void markAllAsRead(Long userId) {
        List<Notification> unread = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().filter(n -> !n.isRead()).toList();
        unread.forEach(Notification::markAsRead);
    }
}
