package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity @Table(name="teacher_worship_attendances",uniqueConstraints=@UniqueConstraint(columnNames={"teacher_id","worship_date"}))
@Getter @Setter @NoArgsConstructor
public class TeacherWorshipAttendance {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="teacher_id",nullable=false) private User teacher;
    @Column(nullable=false) private LocalDate worshipDate;
    @Column(nullable=false,length=10) private String gender;
    @Column(nullable=false,length=10) private String status;
    private long revision;
    private LocalDateTime updatedAt;
    private Long updatedBy;
    @Column(length=500) private String correctionReason;
}
