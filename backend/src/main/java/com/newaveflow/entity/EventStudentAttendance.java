package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "event_student_attendances",
       uniqueConstraints = @UniqueConstraint(columnNames = {"event_id", "student_id"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class EventStudentAttendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id")
    private User teacher;

    @Column(nullable = false, length = 20)
    private String status; // PRESENT / PARTIAL / ABSENT

    @Column(length = 255)
    private String absenceReason;

    @Column
    private java.time.LocalDate partialFromDate;

    @Column(length = 255)
    private String partialNote;

    public void update(String status, String absenceReason,
                       java.time.LocalDate partialFromDate, String partialNote) {
        this.status = status;
        this.absenceReason = absenceReason;
        this.partialFromDate = partialFromDate;
        this.partialNote = partialNote;
    }
}
