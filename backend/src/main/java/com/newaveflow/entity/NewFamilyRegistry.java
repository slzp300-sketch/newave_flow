package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
/** Serializes rare roster transitions with team submission, including an empty roster. */
@Entity @Table(name="new_family_registry") @Getter @Setter @NoArgsConstructor
public class NewFamilyRegistry {
    @Id private Long id=1L;
    @Column(nullable=false) private long changeNumber;
}
