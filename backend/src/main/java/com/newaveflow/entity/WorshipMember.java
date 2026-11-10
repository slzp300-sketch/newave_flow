package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
@Entity @Table(name="worship_members") @Getter @Setter @NoArgsConstructor
public class WorshipMember {
 @Id private Long id;
 @OneToOne(fetch=FetchType.LAZY) @MapsId @JoinColumn(name="id") private User user;
}
