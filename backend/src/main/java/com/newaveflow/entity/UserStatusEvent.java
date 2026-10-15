package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/** Administrative history, never exposed in public teacher/profile responses. */
@Entity @Table(name = "user_status_events")
@Getter @NoArgsConstructor(access = AccessLevel.PROTECTED) @AllArgsConstructor @Builder
public class UserStatusEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private Long userId;
    private Long actorId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30) private Action action;
    @Column(nullable = false, columnDefinition = "TEXT") private String reason;
    private Long reportId;
    @Builder.Default @Column(nullable = false) private LocalDateTime createdAt = LocalDateTime.now();
    public enum Action { SUSPEND, RESTORE, LEGACY_SUSPEND }
}
