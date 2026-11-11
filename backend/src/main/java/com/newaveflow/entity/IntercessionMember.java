package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
@Entity @Table(name="intercession_members") @Getter @Setter @NoArgsConstructor
public class IntercessionMember {
 @Id private Long id;
 @OneToOne(fetch=FetchType.LAZY) @MapsId @JoinColumn(name="id") private User user;
}
