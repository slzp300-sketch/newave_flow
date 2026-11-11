package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
@Entity @Table(name="intercession_registry") @Getter @Setter @NoArgsConstructor
public class IntercessionRegistry {
 @Id private Long id=1L;
 @Column(nullable=false) private long revision=0;
}
