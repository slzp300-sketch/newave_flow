package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.*;
import java.util.*;
@Entity @Table(name="worship_weeks") @Getter @Setter @NoArgsConstructor
public class WorshipWeek {
 @Id private LocalDate worshipDate;
 // Stable numeric key for the existing reviewed-content privacy inventory.
 @Column(nullable=false,unique=true) private long id;
 @Column(nullable=false) private long revision;
 @Column(length=10,nullable=false) private String intercessionGrade="";
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="offering_prayer_id") private User offeringPrayer;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="representative_prayer_id") private Student representativePrayer;
 @ManyToMany @JoinTable(name="worship_offerings",joinColumns=@JoinColumn(name="worship_date"),inverseJoinColumns=@JoinColumn(name="student_id"))
 @OrderColumn(name="position") private List<Student> offerings=new ArrayList<>();
 @Column(length=160,nullable=false) private String noticeMessage="";
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="announced_by_id") private User announcedBy;
 private LocalDateTime announcedAt;
}
