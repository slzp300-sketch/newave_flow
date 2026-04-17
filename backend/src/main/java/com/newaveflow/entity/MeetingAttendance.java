package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "meeting_attendances",
       uniqueConstraints = @UniqueConstraint(columnNames = {"teacher_id", "meeting_date"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class MeetingAttendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private User teacher;

    @Column(nullable = false)
    private LocalDate meetingDate;

    @Column(length = 50)
    private String status;

    public void updateStatus(String status) {
        this.status = status;
    }
}
