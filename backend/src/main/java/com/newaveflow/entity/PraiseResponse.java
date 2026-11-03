package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.*;
@Entity @Getter @Setter @NoArgsConstructor
@Table(name="praise_responses",uniqueConstraints=@UniqueConstraint(columnNames={"term_id","user_id","response_month"}))
public class PraiseResponse {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(optional=false) @JoinColumn(name="term_id") private PraiseTerm term;
 @ManyToOne(optional=false) @JoinColumn(name="user_id") private User user;
 @Column(name="response_month",nullable=false,length=7) private String month;
 @Column(nullable=false,columnDefinition="TEXT") private String dates="[]";
 @Column(nullable=false,columnDefinition="TEXT") private String scheduleVersions="{}";
 @Column(nullable=false) private LocalDateTime submittedAt;
}
