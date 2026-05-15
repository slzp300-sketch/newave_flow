package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "tags")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class Tag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 30, unique = true)
    private String name;

    @Column(length = 20)
    private String category;

    @Column(length = 50)
    private String color;

    public void updateName(String name) {
        this.name = name;
    }

    public void updateCategory(String category) {
        this.category = category;
    }

    public void updateColor(String color) {
        this.color = color;
    }
}
