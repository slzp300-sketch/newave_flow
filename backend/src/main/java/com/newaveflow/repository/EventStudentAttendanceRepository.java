package com.newaveflow.repository;

import com.newaveflow.entity.EventStudentAttendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EventStudentAttendanceRepository extends JpaRepository<EventStudentAttendance, Long> {

    Optional<EventStudentAttendance> findByEventIdAndStudentId(Long eventId, Long studentId);

    @Query("""
        SELECT a FROM EventStudentAttendance a
        JOIN FETCH a.student s
        JOIN FETCH s.classGroup
        WHERE a.event.id = :eventId AND s.classGroup.id = :classGroupId
        """)
    List<EventStudentAttendance> findByEventIdAndClassGroupId(
            @Param("eventId") Long eventId, @Param("classGroupId") Long classGroupId);

    @Query("""
        SELECT a FROM EventStudentAttendance a
        JOIN FETCH a.student s
        JOIN FETCH s.classGroup
        WHERE a.event.id = :eventId
        ORDER BY s.classGroup.name, s.name
        """)
    List<EventStudentAttendance> findAllByEventId(@Param("eventId") Long eventId);

    void deleteAllByEventId(Long eventId);
}
