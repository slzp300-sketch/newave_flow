package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.*;

/** Lifecycle of one canonical Student; admission never creates a second student. */
@Entity @Table(name="new_family_members") @Getter @Setter @NoArgsConstructor
public class NewFamilyMember {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @OneToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="student_id",nullable=false,unique=true) private Student student;
    @Column(nullable=false) private LocalDate firstVisit;
    private LocalDate enrolledOn;
    @Column(nullable=false,columnDefinition="text") private String courseJson="[null,null,null,null]";
    @Column(nullable=false,length=20) private String decision="REVIEW";
    @Column(nullable=false,length=500) private String decisionReason="";
    @Column(length=100) private String decidedBy;
    private LocalDateTime decidedAt;
    private LocalDate graduatedOn;
    @Column(nullable=false) private boolean assignmentRequested;
    @Column(nullable=false,length=1000) private String memo="";
    @Column(nullable=false,length=500) private String handoffMemo="";
    @Column(nullable=false,length=100) private String introducer="";
    @Column(nullable=false,length=100) private String updatedBy="";
    @Column(nullable=false) private LocalDateTime updatedAt=LocalDateTime.now();
    @Version private long revision;
}
