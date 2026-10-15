package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity @Table(name="moderated_photos", uniqueConstraints=@UniqueConstraint(name="uk_moderated_photo_target",columnNames={"target_type","target_id"}))
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED) @AllArgsConstructor @Builder
public class ModeratedPhoto {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Version @Builder.Default @Column(nullable=false) private long revision=0;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=20) private TargetType targetType;
    @Column(nullable=false) private Long targetId;
    @Column(columnDefinition="TEXT") private String pendingImage;
    private Long submittedBy;
    @Column(nullable=false) private LocalDateTime submittedAt;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=20) private Status status;
    private Long reviewedBy;
    private LocalDateTime reviewedAt;
    @Column(columnDefinition="TEXT") private String reviewNote;
    public enum TargetType { USER, STUDENT }
    public enum Status { PENDING, APPROVED, REJECTED, HIDDEN }
    public void submit(String image, Long actorId) {
        pendingImage=image; submittedBy=actorId; submittedAt=LocalDateTime.now();
        status=Status.PENDING; reviewedBy=null; reviewedAt=null; reviewNote=null;
    }
    public void resolve(Status result, Long actorId, String note) {
        status=result; pendingImage=null; reviewedBy=actorId; reviewedAt=LocalDateTime.now(); reviewNote=note;
    }
}
