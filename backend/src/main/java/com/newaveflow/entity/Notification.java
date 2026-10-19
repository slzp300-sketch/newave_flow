package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "notifications", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "dedupe_key"}))
@EntityListeners(AuditingEntityListener.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NotificationType type;

    @Column(length = 180) private String dedupeKey;
    @Column(length = 200) private String targetPath;

    @Column(nullable = false)
    @Builder.Default
    private boolean isRead = false;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;
    
    public void markAsRead() {
        this.isRead = true;
    }

    public enum NotificationType {
        EVENT, MINUTE, SYSTEM, ATTENDANCE, EVENT_DEADLINE, TTS, MEETING_VOTE, EVANGELISM
    }
}
