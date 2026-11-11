package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.*;
@Entity @Getter @Setter @NoArgsConstructor
@Table(name="praise_members",uniqueConstraints={@UniqueConstraint(columnNames={"term_id","user_id"}),@UniqueConstraint(columnNames={"term_id","student_id"})})
public class PraiseMember {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(optional=false) @JoinColumn(name="term_id") private PraiseTerm term;
 @ManyToOne @JoinColumn(name="user_id") private User user;
 @ManyToOne @JoinColumn(name="student_id") private Student student;
 @Column(nullable=false,columnDefinition="TEXT") private String parts="[]";
 @Column(nullable=false) private boolean active=true;
}
