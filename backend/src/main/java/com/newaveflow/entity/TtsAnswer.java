package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "tts_answers")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class TtsAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "record_id", nullable = false)
    private TtsRecord record;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private TtsQuestion question;

    @Column(columnDefinition = "TEXT")
    private String answerData; // JSON or simple string value
}
