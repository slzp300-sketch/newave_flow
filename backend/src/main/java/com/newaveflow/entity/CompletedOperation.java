package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "completed_operations", uniqueConstraints = @UniqueConstraint(columnNames = {"actor_id", "operation_key"}))
@Getter @Builder @NoArgsConstructor(access = AccessLevel.PROTECTED) @AllArgsConstructor
public class CompletedOperation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "actor_id", nullable = false) private Long actorId;
    @Column(name = "operation_key", nullable = false, length = 64) private String operationKey;
    @Column(nullable = false, length = 64) private String fingerprint;
    @Column(nullable = false, columnDefinition = "TEXT") private String resultJson;
    @Builder.Default @Column(nullable = false) private java.time.LocalDateTime completedAt = java.time.LocalDateTime.now();
}
