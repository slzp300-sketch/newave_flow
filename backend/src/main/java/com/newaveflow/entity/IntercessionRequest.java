package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
@Entity @Table(name="intercession_requests",indexes={@Index(name="ix_intercession_requests_status",columnList="status,id"),@Index(name="ix_intercession_requests_author",columnList="author_id,id")}) @Getter @Setter @NoArgsConstructor
public class IntercessionRequest {
 public enum Status { PENDING, READY, PUBLISHED, ANSWERED, ARCHIVED }
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="author_id") private User author;
 @Column(length=80,nullable=false) private String senderName="";
 @Column(length=80,nullable=false) private String title;
 @Column(columnDefinition="text",nullable=false) private String body;
 @Column(length=20,nullable=false) private String category;
 @Column(length=10,nullable=false) private String source;
 @Column(nullable=false) private boolean share;
 @Column(nullable=false) private boolean anonymous;
 @Column(length=80,nullable=false) private String publicTitle="";
 @Column(columnDefinition="text",nullable=false) private String publicText="";
 @Enumerated(EnumType.STRING) @Column(length=12,nullable=false) private Status status=Status.PENDING;
 @Column(nullable=false) private long revision=0;
 @Column(nullable=false) private LocalDateTime createdAt;
 @Column(nullable=false) private LocalDateTime updatedAt;
}
