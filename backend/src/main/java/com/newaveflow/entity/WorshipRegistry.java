package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
@Entity @Table(name="worship_registry") @Getter @Setter @NoArgsConstructor
public class WorshipRegistry {
 @Id private Long id=1L;
 @Column(nullable=false) private long revision;
}
