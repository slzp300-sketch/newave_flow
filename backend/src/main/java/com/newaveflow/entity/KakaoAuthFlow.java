package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "kakao_auth_flows")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class KakaoAuthFlow {
    @Id @Column(length = 36) private String id;
    @Column(nullable = false, unique = true, length = 64) private String stateHash;
    @Column(nullable = false, length = 43) private String challenge;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Purpose purpose;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Stage stage;
    @Column(nullable = false) private boolean nativeClient;
    @Column(nullable = false) private Instant expiresAt;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id")
    @org.hibernate.annotations.OnDelete(action = org.hibernate.annotations.OnDeleteAction.CASCADE)
    private User user;
    private Long authVersion;
    @Column(length = 64) private String ticketHash;
    @Column(name = "kakao_id", length = 100) private String kakaoId;
    @Column(length = 20) private String failure;
    public enum Purpose { LOGIN, LINK }
    public enum Stage { STARTED, AUTHORIZED, REGISTERING }
}
