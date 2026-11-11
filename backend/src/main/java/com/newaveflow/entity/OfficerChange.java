package com.newaveflow.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
@Entity @Table(name="officer_changes") @Getter @Setter @NoArgsConstructor
public class OfficerChange {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(nullable=false,length=20) private String action;
    @Column(nullable=false) private int termYear;
    @Enumerated(EnumType.STRING) @Column(length=30) private OfficerPosition position;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="previous_user_id") private User previousUser;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="next_user_id") private User nextUser;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="actor_id") private User actor;
    @Column(nullable=false) private LocalDateTime changedAt;
}
