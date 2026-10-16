package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "apple_auth_flows")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AppleAuthFlow {
    @Id @Column(length = 36) private String id;
    @Column(nullable = false, length = 64) private String stateHash;
    @Column(nullable = false, length = 64) private String nonceHash;
    @Column(nullable = false, length = 43) private String challenge;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Purpose purpose;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Stage stage;
    @Column(nullable = false) private Instant expiresAt;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id")
    @org.hibernate.annotations.OnDelete(action = org.hibernate.annotations.OnDeleteAction.CASCADE)
    private User user;
    private Long authVersion;
    @Column(length = 64) private String ticketHash;
    @Column(length = 255) private String subject;
    @Column(columnDefinition = "TEXT") private String refreshTokenCiphertext;
    @Column(length = 100) private String verifiedEmail;
    private Boolean emailPrivate;
    public enum Purpose { LOGIN, LINK, DELETE }
    public enum Stage { STARTED, REGISTERING, DELETE_READY }
}
