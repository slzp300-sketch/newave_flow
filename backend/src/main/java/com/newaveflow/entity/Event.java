package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "events")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(length = 255)
    private String description;

    @Column(nullable = false)
    private LocalDate eventDate;

    @Column
    private LocalDate endDate;

    @Column(length = 20)
    private String startTime;

    @Column(length = 20)
    private String endTime;

    @Column(length = 20)
    private String color; // hex color or class name

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EventType eventType;

    @Column(nullable = false)
    @Builder.Default
    private boolean attendanceRequired = false;

    @Column
    private LocalDate attendanceDeadline;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private AttendanceTarget attendanceTarget = AttendanceTarget.STUDENT_ONLY;

    public enum EventType {
        SPECIAL, MEETING, REGULAR, CHURCH_WIDE
    }

    public enum AttendanceTarget {
        STUDENT_ONLY, TEACHER_ONLY, BOTH
    }
}
