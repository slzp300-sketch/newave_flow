package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

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

    @Column(columnDefinition = "TEXT")
    private String reason;

    // 마지막 수정 시각 (관리자 화면 표시용)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (updatedAt == null) updatedAt = LocalDateTime.now();
    }

    public void updateStatus(String status, String reason) {
        this.status = status;
        this.reason = reason;
        this.updatedAt = LocalDateTime.now();
    }
}
