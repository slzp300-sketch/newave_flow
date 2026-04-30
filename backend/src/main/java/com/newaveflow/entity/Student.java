package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "students")
@EntityListeners(AuditingEntityListener.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class Student {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_group_id", nullable = false)
    private ClassGroup classGroup;

    @Column(length = 20)
    private String grade;

    private LocalDate birthDate;

    @Column(length = 10)
    private String gender;

    @Column(length = 100)
    private String school;

    @Column(length = 20)
    private String phone;

    private Boolean baptism;

    @Column(length = 50)
    private String fatherName;

    @Column(length = 50)
    private String fatherPhone;

    @Column(length = 50)
    private String motherName;

    @Column(length = 50)
    private String motherPhone;

    @Column(length = 255)
    private String address;

    @Column(columnDefinition = "TEXT")
    private String profileImage;

    @Column(nullable = false)
    @Builder.Default
    private boolean isActive = true;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    public void update(String name, String gender, LocalDate birthDate,
                       String school, String phone, Boolean baptism,
                       String fatherName, String fatherPhone,
                       String motherName, String motherPhone, String address, String profileImage) {
        this.name = name;
        this.gender = gender;
        this.birthDate = birthDate;
        this.school = school;
        this.phone = phone;
        this.baptism = baptism;
        this.fatherName = fatherName;
        this.fatherPhone = fatherPhone;
        this.motherName = motherName;
        this.motherPhone = motherPhone;
        this.address = address;
        this.profileImage = profileImage;
    }

    public void assignClass(ClassGroup classGroup) { this.classGroup = classGroup; }
    public void updateGrade(String grade) { this.grade = grade; }
    public void deactivate() { this.isActive = false; }
    public void activate()   { this.isActive = true; }
}
