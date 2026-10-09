package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * 앱 도입 전 구글 시트(주차별점수)에서 가져온 TTS 점수.
 * 이름으로만 저장하고, 통계에서 같은 이름의 교사와 묶는다.
 */
@Entity
@Table(name = "tts_legacy_score",
       uniqueConstraints = @UniqueConstraint(columnNames = {"name", "info_year", "week_num"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class TtsLegacyScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(name = "info_year", nullable = false)
    private Integer infoYear;

    @Column(name = "week_num", nullable = false)
    private Integer weekNum;

    @Column(nullable = false)
    private Integer score;
}
