package com.newaveflow.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity @Table(name="notification_preferences") @Getter @Setter
@NoArgsConstructor @AllArgsConstructor
public class NotificationPreference {
    @Id private Long userId;
    @Column(nullable=false) private boolean pushEnabled;
}
