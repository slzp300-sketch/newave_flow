package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.*;
@Entity @Table(name="worship_tasks",uniqueConstraints=@UniqueConstraint(columnNames={"worship_date","task_key"})) @Getter @Setter @NoArgsConstructor
public class WorshipTask {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="worship_date") private WorshipWeek week;
 @Column(length=30,nullable=false) private String taskKey;
 @Column(nullable=false) private long revision;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="assignee_id") private User assignee;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="completed_by_id") private User completedBy;
 private LocalDateTime completedAt;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="reviewed_by_id") private User reviewedBy;
 private LocalDateTime reviewedAt;
}
