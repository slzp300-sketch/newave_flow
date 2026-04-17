package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "checklist_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class ChecklistItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(length = 255)
    private String description;

    @Column(length = 50)
    private String category;

    @Column(nullable = false)
    @Builder.Default
    private boolean isRequired = false;

    @Column(nullable = false)
    @Builder.Default
    private Integer orderIndex = 0;
}
