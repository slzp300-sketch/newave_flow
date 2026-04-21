package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "teacher_classes",
       uniqueConstraints = @UniqueConstraint(columnNames = {"teacher_id", "class_group_id"}))
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class TeacherClass {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private User teacher;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_group_id", nullable = false)
    private ClassGroup classGroup;

    @Column(nullable = false)
    @Builder.Default
    private boolean isPrimary = false;
}
