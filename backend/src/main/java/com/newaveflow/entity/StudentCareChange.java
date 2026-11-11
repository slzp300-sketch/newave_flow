package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/** Audit metadata only: no duplicate copies of sensitive free text. */
@Entity @Table(name="student_care_changes",indexes=@Index(name="ix_care_change_record",columnList="record_id,id"))
@Getter @Setter @NoArgsConstructor
public class StudentCareChange {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="record_id",nullable=false) private StudentCareRecord record;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="actor_id") private User actor;
 @Column(nullable=false,length=25) private String action;
 @Column(nullable=false) private LocalDateTime occurredAt;
}
