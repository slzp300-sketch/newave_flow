package com.newaveflow.repository;

import com.newaveflow.entity.EventAttendance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EventAttendanceRepository extends JpaRepository<EventAttendance, Long> {
    Optional<EventAttendance> findByEventIdAndTeacherId(Long eventId, Long teacherId);

    @org.springframework.transaction.annotation.Transactional
    void deleteAllByEventId(Long eventId);

    @org.springframework.data.jpa.repository.Query("SELECT a FROM EventAttendance a JOIN FETCH a.teacher WHERE a.event.id = :eventId")
    java.util.List<EventAttendance> findAllByEventIdWithTeacher(@org.springframework.data.repository.query.Param("eventId") Long eventId);
}
