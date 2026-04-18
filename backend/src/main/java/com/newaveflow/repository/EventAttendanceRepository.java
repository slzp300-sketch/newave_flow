package com.newaveflow.repository;

import com.newaveflow.entity.EventAttendance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EventAttendanceRepository extends JpaRepository<EventAttendance, Long> {
    Optional<EventAttendance> findByEventIdAndTeacherId(Long eventId, Long teacherId);

    @org.springframework.transaction.annotation.Transactional
    void deleteAllByEventId(Long eventId);
}
