package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity @Table(name="weekly_report_exports") @Getter @Setter @NoArgsConstructor
public class WeeklyReportExport {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(nullable=false) private LocalDate reportDate;
    @Column(nullable=false,columnDefinition="TEXT") private String payload;
    @Column(nullable=false,length=64) private String sourceHash;
    @Column(nullable=false,length=50) private String templateVersion;
    @Column(nullable=false) private LocalDateTime createdAt;
    @Column(nullable=false,length=100) private String createdBy;
}
