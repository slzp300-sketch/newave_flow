package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "student_memos",
       uniqueConstraints = @UniqueConstraint(columnNames = {"student_id", "teacher_id"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class StudentMemo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private User teacher;

    @Column(columnDefinition = "TEXT")
    private String prayerRequest;

    @Column(columnDefinition = "TEXT")
    private String sketch;

    private LocalDateTime updatedAt;

    public void update(String prayerRequest, String sketch) {
        this.prayerRequest = prayerRequest;
        this.sketch = sketch;
        this.updatedAt = LocalDateTime.now();
    }
}
