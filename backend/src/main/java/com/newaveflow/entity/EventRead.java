package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import java.time.LocalDateTime;

@Entity
@Table(name = "event_reads", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "event_id"}))
@Getter @NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EventRead {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "event_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Event event;
    @Column(nullable = false, length = 64)
    private String contentVersion;
    @Column(nullable = false)
    private LocalDateTime readAt;

    public EventRead(User user, Event event, String version) {
        this.user = user;
        this.event = event;
        acknowledge(version);
    }
    public void acknowledge(String version) {
        this.contentVersion = version;
        this.readAt = LocalDateTime.now();
    }
}
