package com.newaveflow.repository;

import com.newaveflow.entity.MeetingMinute;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MeetingMinuteRepository extends JpaRepository<MeetingMinute, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select m from MeetingMinute m where m.id=:id")
    java.util.Optional<MeetingMinute> lockById(@org.springframework.data.repository.query.Param("id") Long id);
    List<MeetingMinute> findAllByOrderByMeetingDateDesc();
    List<MeetingMinute> findAllByIsActiveTrueOrderByMeetingDateDesc();
    boolean existsByMeetingDateBetweenAndIsActiveTrue(java.time.LocalDate start, java.time.LocalDate end);
}
