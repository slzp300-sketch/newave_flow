package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.time.LocalDateTime;

/** A receipt for a verified request, not a substitute for the reviewed deletion transaction. */
@Entity
@Table(name = "account_deletion_requests")
@Getter @Builder @AllArgsConstructor @NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AccountDeletionRequest {
    @Id @Column(length = 36) private String id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", unique = true) private User user;
    private LocalDateTime userCreatedAt;
    @Column(nullable = false, unique = true, length = 64) private String receiptTokenHash;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Status status;
    @Column(nullable = false) private Instant requestedAt;
    @Column(nullable = false) private Instant targetAt;
    private Instant completedAt;
    @Column(nullable = false) private boolean handoverRequired;

    public enum Status { REQUESTED, COMPLETED }
    public void renewReceipt(String hash) { receiptTokenHash = hash; }
}
