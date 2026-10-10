package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;

/** Historical roster values; deliberately independent of current class/name/active flags. */
@Entity @Table(name = "event_participants", uniqueConstraints = @UniqueConstraint(columnNames = {"event_id", "kind", "person_id"}))
@Getter @Builder @NoArgsConstructor(access = AccessLevel.PROTECTED) @AllArgsConstructor
public class EventParticipant {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private Long eventId;
    @Column(nullable = false, length = 10) private String kind;
    @Column(nullable = false) private Long personId;
    @Column(nullable = false, length = 100) private String name;
    private String grade;
    private Long classGroupId;
    private String classGroupName;
    @Builder.Default @Column(nullable = false) private java.time.LocalDateTime capturedAt = java.time.LocalDateTime.now();
}
