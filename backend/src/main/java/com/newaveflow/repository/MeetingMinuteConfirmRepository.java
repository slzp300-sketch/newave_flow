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
        AND NOT EXISTS (
            SELECT a FROM MeetingAttendance a
            WHERE a.teacher = :user AND a.meetingDate = m.meetingDate AND a.status = 'ATTEND'
        )
        """)
    long countUnconfirmedForUser(@org.springframework.data.repository.query.Param("user") com.newaveflow.entity.User user);

    @org.springframework.data.jpa.repository.Query("""
        SELECT COUNT(c) > 0 FROM MeetingMinuteConfirm c
        WHERE c.user = :user
        AND c.minutes.meetingDate BETWEEN :start AND :end
        AND c.minutes.isActive = true
        """)
    boolean existsByUserAndMeetingDateBetween(
        @org.springframework.data.repository.query.Param("user") com.newaveflow.entity.User user,
        @org.springframework.data.repository.query.Param("start") java.time.LocalDate start,
        @org.springframework.data.repository.query.Param("end") java.time.LocalDate end
    );
}
