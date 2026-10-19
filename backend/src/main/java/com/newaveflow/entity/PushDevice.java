package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name="push_devices", uniqueConstraints=@UniqueConstraint(columnNames="token_hash"))
@Getter @Setter @NoArgsConstructor
public class PushDevice {
    @Id @Column(length=36) private String installationId;
    @Column(nullable=false) private Long userId;
    @Column(nullable=false,length=10) private String platform;
    @Column(nullable=false,length=4096) private String token;
    @Column(nullable=false,length=64) private String tokenHash;
    @Column(length=50) private String appVersion;
    @Column(nullable=false) private boolean active;
    @Column(nullable=false) private Instant updatedAt;
}
