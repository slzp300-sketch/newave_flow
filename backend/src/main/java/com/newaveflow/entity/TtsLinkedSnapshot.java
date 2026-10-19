package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import java.time.LocalDate;

/** The closed quarter's TTS result survives later edits to the source activity. */
@Entity
@Table(name = "tts_linked_snapshots", uniqueConstraints = @UniqueConstraint(columnNames = {"teacher_id", "week_start", "link_type"}))
@Getter @Builder @NoArgsConstructor(access = AccessLevel.PROTECTED) @AllArgsConstructor
public class TtsLinkedSnapshot {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "teacher_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User teacher;
    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;
    @Enumerated(EnumType.STRING) @Column(name = "link_type", nullable = false, length = 30)
    private TtsQuestion.TtsLinkType linkType;
    @Column(nullable = false)
    private boolean checked;
}
