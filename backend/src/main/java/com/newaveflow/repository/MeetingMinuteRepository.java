package com.newaveflow.repository;

import com.newaveflow.entity.MeetingMinute;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MeetingMinuteRepository extends JpaRepository<MeetingMinute, Long> {
    List<MeetingMinute> findAllByOrderByMeetingDateDesc();
    List<MeetingMinute> findAllByIsActiveTrueOrderByMeetingDateDesc();
    boolean existsByMeetingDateBetweenAndIsActiveTrue(java.time.LocalDate start, java.time.LocalDate end);
}
