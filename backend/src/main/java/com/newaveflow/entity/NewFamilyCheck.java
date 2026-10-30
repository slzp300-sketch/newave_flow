package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.*;
@Entity @Table(name="new_family_checks",uniqueConstraints=@UniqueConstraint(columnNames={"member_id","worship_date"})) @Getter @Setter @NoArgsConstructor
public class NewFamilyCheck {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="member_id",nullable=false) private NewFamilyMember member;
    @Column(nullable=false) private LocalDate worshipDate;
    @Column(nullable=false,length=10) private String status;
    @Column(nullable=false,length=100) private String updatedBy;
    @Column(nullable=false) private LocalDateTime updatedAt;
}
