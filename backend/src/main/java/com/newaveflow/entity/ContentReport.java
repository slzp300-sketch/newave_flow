package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "content_reports", uniqueConstraints = @UniqueConstraint(name = "uk_content_report_request", columnNames = {"reporter_id", "request_id"}))
@Getter @NoArgsConstructor(access = AccessLevel.PROTECTED) @AllArgsConstructor @Builder
public class ContentReport {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Version @Builder.Default @Column(nullable = false) private long revision = 0;
    @Column(nullable = false) private Long reporterId;
    @Column(nullable = false, length = 36) private String requestId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private TargetType targetType;
    @Enumerated(EnumType.STRING) @Column(length = 30) private ContentType contentType;
    private Long targetId;
    @Column(nullable = false, length = 200) private String subject;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30) private Reason reason;
    @Column(nullable = false, columnDefinition = "TEXT") private String details;
    @Enumerated(EnumType.STRING) @Builder.Default @Column(nullable = false, length = 20) private Status status = Status.OPEN;
    @Enumerated(EnumType.STRING) @Builder.Default @Column(nullable = false, length = 30) private Action action = Action.NONE;
    @Column(columnDefinition = "TEXT") private String resolutionNote;
    private Long moderatorId;
    @Builder.Default @Column(nullable = false) private LocalDateTime createdAt = LocalDateTime.now();
    @Builder.Default @Column(nullable = false) private LocalDateTime updatedAt = LocalDateTime.now();
    private LocalDateTime resolvedAt;

    public enum TargetType { CONTENT, USER }
    public enum ContentType { MEETING_MINUTE, DAILY_REPORT, OTHER }
    public enum Reason { INAPPROPRIATE_CONTENT, HARASSMENT, PRIVACY, OTHER }
    public enum Status { OPEN, REVIEWING, RESOLVED, DISMISSED }
    public enum Action { NONE, HIDE_MINUTE, SUSPEND_USER, REVIEWED }

    public void resolve(Status status, Action action, String note, Long moderatorId) {
        this.status = status; this.action = action; this.resolutionNote = note; this.moderatorId = moderatorId;
        this.updatedAt = LocalDateTime.now();
        this.resolvedAt = status == Status.RESOLVED || status == Status.DISMISSED ? updatedAt : null;
    }
}
