package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
@Entity @Table(name="officer_registry") @Getter @Setter @NoArgsConstructor
public class OfficerRegistry {
    @Id private Long id=1L;
    @Column(nullable=false) private int activeYear;
    @Column(nullable=false) private long revision;
}
