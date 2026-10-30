package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity @Table(name="weekly_class_supplements", uniqueConstraints=@UniqueConstraint(columnNames={"class_group_id","report_date"}))
@Getter @Setter @NoArgsConstructor
public class WeeklyClassSupplement {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="class_group_id",nullable=false) private ClassGroup classGroup;
    @Column(nullable=false) private LocalDate reportDate;
    @Column(columnDefinition="TEXT",nullable=false) private String payload;
}
