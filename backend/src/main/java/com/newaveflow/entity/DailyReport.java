package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "daily_reports",
       uniqueConstraints = @UniqueConstraint(columnNames = {"teacher_id", "class_group_id", "report_date"}))
@EntityListeners(AuditingEntityListener.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class DailyReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private User teacher;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_group_id", nullable = false)
    private ClassGroup classGroup;

    @Column(nullable = false)
    private LocalDate reportDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private Status status = Status.DRAFT;

    @Builder.Default private int totalStudents = 0;
    @Builder.Default private int presentCount   = 0;
    @Builder.Default private int absentCount    = 0;
    @Builder.Default private int lateCount      = 0;

    @Column(columnDefinition = "TEXT")
    private String specialNotes;

    private LocalDateTime submittedAt;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    public enum Status { DRAFT, SUBMITTED }

    public void submit() {
        this.status = Status.SUBMITTED;
        this.submittedAt = LocalDateTime.now();
    }

    public void updateCounts(int total, int present, int absent, int late, String notes) {
        this.totalStudents = total;
        this.presentCount  = present;
        this.absentCount   = absent;
        this.lateCount     = late;
        this.specialNotes  = notes;
    }
}
