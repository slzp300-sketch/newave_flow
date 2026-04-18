package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "evangelism_schedules")
@EntityListeners(AuditingEntityListener.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class EvangelismSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDate scheduledDate;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column(length = 20)
    @Builder.Default
    private String status = "ACTIVE";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responsible_group_id", nullable = true)
    private EvangelismGroup responsibleGroup;

    @OneToMany(mappedBy = "schedule", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<EvangelismAssignment> assignments = new ArrayList<>();

    public void update(LocalDate scheduledDate, EvangelismGroup responsibleGroup) {
        this.scheduledDate = scheduledDate;
        this.responsibleGroup = responsibleGroup;
    }

    public void cancel() {
        this.status = "CANCELED";
    }
}
