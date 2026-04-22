package com.newaveflow.service;

import com.newaveflow.dto.NotificationResponse;
import com.newaveflow.entity.Notification;
import com.newaveflow.entity.User;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.NotificationRepository;
import com.newaveflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NotificationService {
    
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    @Transactional
    public void createNotification(Long userId, String title, String content, Notification.NotificationType type) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return;
        
        Notification notification = Notification.builder()
                .user(user)
                .title(title)
                .content(content)
                .type(type)
                .build();
        notificationRepository.save(notification);
    }
    
    @Transactional
    public void createNotificationForUsers(List<Long> userIds, String title, String content, Notification.NotificationType type) {
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
