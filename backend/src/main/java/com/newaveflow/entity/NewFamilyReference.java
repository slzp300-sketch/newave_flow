package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.*;
@Entity @Table(name="new_family_references",uniqueConstraints=@UniqueConstraint(columnNames={"report_date","class_id","visitor_id"})) @Getter @Setter @NoArgsConstructor
public class NewFamilyReference {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(nullable=false) private LocalDate reportDate;
    @Column(nullable=false) private Long classId;
    @Column(nullable=false,length=60) private String visitorId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="member_id",nullable=false) private NewFamilyMember member;
    @Column(nullable=false,length=100) private String linkedBy;
    @Column(nullable=false) private LocalDateTime linkedAt;
}
