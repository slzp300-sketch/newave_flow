package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "event_attendances",
       uniqueConstraints = @UniqueConstraint(columnNames = {"event_id", "teacher_id"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class EventAttendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private User teacher;

    @Column(length = 50)
    private String status;

    public void updateStatus(String status) {
        this.status = status;
    }
}
