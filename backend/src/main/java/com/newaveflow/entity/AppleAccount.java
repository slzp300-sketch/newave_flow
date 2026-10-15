package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "apple_accounts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AppleAccount {
    @Id @Column(name = "user_id") private Long userId;
    @MapsId @OneToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id")
    @org.hibernate.annotations.OnDelete(action = org.hibernate.annotations.OnDeleteAction.CASCADE)
    private User user;
    @Column(nullable = false, unique = true, length = 255) private String subject;
    @Column(columnDefinition = "TEXT") private String refreshTokenCiphertext;
    private Instant revokedAt;
}
