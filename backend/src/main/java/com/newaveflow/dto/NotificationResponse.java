package com.newaveflow.dto;

import com.newaveflow.entity.Notification;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class NotificationResponse {
    private final Long id;
    private final String title;
    private final String content;
    private final String type;
    private final boolean read;
    private final LocalDateTime createdAt;

    public NotificationResponse(Notification notification) {
        this.id = notification.getId();
        this.title = notification.getTitle();
        this.content = notification.getContent();
        this.type = notification.getType().name();
        this.read = notification.isRead();
        this.createdAt = notification.getCreatedAt();
    }
}
