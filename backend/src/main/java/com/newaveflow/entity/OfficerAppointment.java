package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
@Entity @Table(name="officer_appointments", uniqueConstraints=@UniqueConstraint(columnNames={"term_year","position"}))
@Getter @Setter @NoArgsConstructor
public class OfficerAppointment {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="term_year",nullable=false) private int termYear;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=30) private OfficerPosition position;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="user_id") private User user;
}
