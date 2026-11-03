package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.*;
@Entity @Getter @Setter @NoArgsConstructor
@Table(name="praise_weeks",uniqueConstraints=@UniqueConstraint(columnNames={"term_id","worship_date"}))
public class PraiseWeek {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(optional=false) @JoinColumn(name="term_id") private PraiseTerm term;
 @Column(nullable=false) private LocalDate worshipDate;
 @Column(nullable=false) private LocalDate practiceDate;
 @Column(nullable=false) private LocalTime startTime=LocalTime.of(17,0);
 @Column(nullable=false) private LocalTime endTime=LocalTime.of(19,0);
 @Column(nullable=false) private long scheduleVersion;
 @Column(nullable=false,columnDefinition="TEXT") private String slots="{}";
 @Column(columnDefinition="TEXT") private String publishedSlots;
 private LocalDateTime publishedAt;
 private LocalDateTime updatedAt;
}
