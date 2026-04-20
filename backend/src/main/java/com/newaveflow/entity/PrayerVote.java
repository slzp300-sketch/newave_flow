package com.newaveflow.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "prayer_votes",
       uniqueConstraints = @UniqueConstraint(columnNames = {"teacher_id", "week_start"}))
@EntityListeners(AuditingEntityListener.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class PrayerVote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private User teacher;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Status status;

    @Column(length = 500)
    private String reason;

    @Column(nullable = false)
    @Builder.Default
    private boolean scriptureCopySubmitted = false;

    private LocalDateTime scriptureCopySubmittedAt;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    public enum Status { TUE, THU, ABSENT }

    public void update(Status status, String reason) {
        this.status = status;
        this.reason = reason;
        if (status != Status.ABSENT) {
            this.scriptureCopySubmitted = false;
            this.scriptureCopySubmittedAt = null;
        }
    }

    public void markScriptureSubmitted() {
        this.scriptureCopySubmitted = true;
        this.scriptureCopySubmittedAt = LocalDateTime.now();
    }

    public void unmarkScriptureSubmitted() {
        this.scriptureCopySubmitted = false;
        this.scriptureCopySubmittedAt = null;
    }
}
