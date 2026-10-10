package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity @Table(name = "tts_question_revisions", uniqueConstraints = @UniqueConstraint(columnNames = {"question_id", "effective_from"}))
@Getter @Setter @Builder @NoArgsConstructor(access = AccessLevel.PROTECTED) @AllArgsConstructor
public class TtsQuestionRevision {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private Long questionId;
    @Column(nullable = false) private LocalDate effectiveFrom;
    @Column(nullable = false) private String title;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private TtsQuestion.TtsQuestionType type;
    private String emoji;
    private Integer displayOrder;
    @Column(nullable = false) private boolean active;
    private Integer points;
    @Enumerated(EnumType.STRING) private TtsQuestion.TtsLinkType linkType;

    public void capture(TtsQuestion q) {
        title=q.getTitle(); type=q.getType(); emoji=q.getEmoji(); displayOrder=q.getDisplayOrder();
        active=q.isActive(); points=q.getPoints(); linkType=q.getLinkType();
    }
    public TtsQuestion asQuestion() {
        return TtsQuestion.builder().id(questionId).title(title).type(type).emoji(emoji).displayOrder(displayOrder)
                .isActive(active).points(points).linkType(linkType).build();
    }
}
