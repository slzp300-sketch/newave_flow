package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.*;
@Entity @Table(name="intercession_meetings") @Getter @Setter @NoArgsConstructor
public class IntercessionMeeting {
 public static final LocalTime START_TIME=LocalTime.of(21,30);
 @Id private LocalDate meetingDate;
 private LocalTime startTime=START_TIME;
 @Column(nullable=false) private boolean canceled=false;
 @Column(length=120,nullable=false) private String cancellationReason="";
 @Column(nullable=false) private int duration=45;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="host_id") private User host;
 @Column(length=1000,nullable=false) private String zoomUrl="";
 @Column(nullable=false) private long revision=0;
 @Column(columnDefinition="text",nullable=false) private String selectedIds="[]";
 // Snapshots contain only approved public text; views revalidate every source revision.
 @Column(columnDefinition="text") private String paper;
 private LocalDateTime preparedAt;
}
