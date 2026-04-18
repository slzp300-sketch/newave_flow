package com.newaveflow.repository;

import com.newaveflow.entity.MeetingMinuteConfirm;
import com.newaveflow.entity.User;
import com.newaveflow.entity.MeetingMinute;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface MeetingMinuteConfirmRepository extends JpaRepository<MeetingMinuteConfirm, Long> {
    Optional<MeetingMinuteConfirm> findByMinutesAndUser(MeetingMinute minutes, User user);
    List<MeetingMinuteConfirm> findAllByMinutes(MeetingMinute minutes);

    @org.springframework.transaction.annotation.Transactional
    void deleteAllByMinutesId(Long minutesId);

    @org.springframework.data.jpa.repository.Query("""
        SELECT COUNT(m) FROM MeetingMinute m
        WHERE m.isActive = true
        AND NOT EXISTS (
            SELECT c FROM MeetingMinuteConfirm c
            WHERE c.minutes = m AND c.user = :user
        )
        """)
    long countUnconfirmedForUser(@org.springframework.data.repository.query.Param("user") com.newaveflow.entity.User user);
}
