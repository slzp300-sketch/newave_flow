package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "tts_item")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class TtsQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "q_type", nullable = false, length = 20)
    private TtsQuestionType type;

    @Column(length = 20)
    private String emoji;

    @Column(name = "display_order")
    private Integer displayOrder;

    @Column(nullable = false)
    @Builder.Default
    private boolean isActive = true;

    // 체크 1회당 점수 (비어 있으면 DAYS 5점, ATTEND 10점)
    private Integer points;

    // 다른 화면 기록과 자동 연동 (비어 있으면 직접 체크)
    @Enumerated(EnumType.STRING)
    @Column(name = "link_type", length = 20)
    private TtsLinkType linkType;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    public enum TtsQuestionType {
        DAYS,   // Mon-Sat/Sun check
        ATTEND  // Yes/No
    }

    public enum TtsLinkType {
        NONE,
        SAT_MEETING,    // 토요 교사회의 '참석'이면 자동 체크
        PRAYER_MEETING  // 줌 기도모임 화/목 참석 투표면 자동 체크
    }
}
