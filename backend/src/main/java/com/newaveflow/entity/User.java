package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@EntityListeners(AuditingEntityListener.class)
@com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(length = 20)
    private String phone;

    @Column(length = 20)
    private String grade;

    @Column(nullable = false)
    @Builder.Default
    private boolean isActive = true;

    @Column(nullable = false, columnDefinition = "boolean default false")
    @Builder.Default
    private boolean largeFont = false;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @OneToMany(mappedBy = "teacher")
    private java.util.List<TeacherClass> teacherClasses;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
    
    public void updateRole(Role role) {
        this.role = role;
    }

    public void updatePassword(String encodedPassword) {
        this.password = encodedPassword;
    }

    public void approve() {
        this.isActive = true;
    }

    public void updateLargeFont(boolean largeFont) {
        this.largeFont = largeFont;
    }

    public enum Role {
        ADMIN, PASTOR, EXECUTIVE, TEACHER
    }
}
