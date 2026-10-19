package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name="push_deliveries",uniqueConstraints=@UniqueConstraint(columnNames={"notification_id","installation_id"}))
@Getter @Setter @NoArgsConstructor
public class PushDelivery {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(nullable=false) private Long notificationId;
    @Column(nullable=false,length=36) private String installationId;
    @Column(nullable=false,length=16) private String status="PENDING";
    @Column(nullable=false) private int attempts;
    @Column(nullable=false) private Instant nextAttemptAt;
    @Column(nullable=false) private Instant expiresAt;
}
