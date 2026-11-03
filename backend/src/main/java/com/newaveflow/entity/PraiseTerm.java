package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.*;
@Entity @Getter @Setter @NoArgsConstructor
@Table(name="praise_terms",uniqueConstraints=@UniqueConstraint(columnNames={"term_year","half"}))
public class PraiseTerm {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(nullable=false) private int termYear;
 @Column(nullable=false) private int half;
 @Column(nullable=false) private long revision;
}
