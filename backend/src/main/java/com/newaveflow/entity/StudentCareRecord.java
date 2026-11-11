package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/** Shared pastoral records are separate from a teacher's private StudentMemo. */
@Entity @Table(name="student_care_records",indexes=@Index(name="ix_care_student",columnList="student_id,created_at"))
@Getter @Setter @NoArgsConstructor
public class StudentCareRecord {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="student_id",nullable=false) private Student student;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="author_id") private User author;
 @Column(nullable=false,length=20) private String kind;
 @Column(nullable=false,columnDefinition="TEXT") private String content;
 @Column(nullable=false) private boolean followUp;
 private LocalDateTime followedAt;
 @Column(nullable=false) private boolean closed;
 @Column(nullable=false) private long revision;
 @Column(nullable=false) private LocalDateTime createdAt;
 @Column(nullable=false) private LocalDateTime updatedAt;
}
