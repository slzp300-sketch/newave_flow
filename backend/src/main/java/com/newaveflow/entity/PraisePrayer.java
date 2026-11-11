package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.*;
@Entity @Getter @Setter @NoArgsConstructor
@Table(name="praise_prayers",uniqueConstraints=@UniqueConstraint(columnNames={"term_id","meeting_date"}))
public class PraisePrayer {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(optional=false) @JoinColumn(name="term_id") private PraiseTerm term;
 @Column(nullable=false) private LocalDate meetingDate;
 @ManyToOne @JoinColumn(name="host_id") private PraiseMember host;
 @Column(length=1000) private String zoomUrl="";
}
