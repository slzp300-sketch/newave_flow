package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity @Table(name="weekly_department_reports",uniqueConstraints=@UniqueConstraint(columnNames="report_date"))
@Getter @Setter @NoArgsConstructor
public class WeeklyDepartmentReport {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(nullable=false) private LocalDate reportDate;
    @Column(columnDefinition="TEXT",nullable=false) private String fieldsJson;
    @Version private long revision;
}
