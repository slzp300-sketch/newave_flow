package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity @Table(name = "community_agreements")
@Getter @NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CommunityAgreement {
    @Id private Long userId;
    @Column(nullable = false, length = 40) private String policyVersion;
    @Column(nullable = false) private LocalDateTime acceptedAt;

    public CommunityAgreement(Long userId, String version) { this.userId = userId; accept(version); }
    public void accept(String version) { policyVersion = version; acceptedAt = LocalDateTime.now(); }
}
