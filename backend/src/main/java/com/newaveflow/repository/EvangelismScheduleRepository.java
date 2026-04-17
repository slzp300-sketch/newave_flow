package com.newaveflow.repository;

import com.newaveflow.entity.EvangelismSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface EvangelismScheduleRepository extends JpaRepository<EvangelismSchedule, Long> {

    @Query("SELECT s FROM EvangelismSchedule s LEFT JOIN FETCH s.assignments a LEFT JOIN FETCH a.teacher LEFT JOIN FETCH a.group ORDER BY s.scheduledDate")
    List<EvangelismSchedule> findAllWithAssignments();

    @Query("SELECT s FROM EvangelismSchedule s LEFT JOIN FETCH s.assignments a LEFT JOIN FETCH a.teacher LEFT JOIN FETCH a.group WHERE s.scheduledDate >= :from ORDER BY s.scheduledDate")
    List<EvangelismSchedule> findUpcomingWithAssignments(@Param("from") LocalDate from);

    @Query("SELECT DISTINCT s FROM EvangelismSchedule s JOIN s.assignments a LEFT JOIN FETCH s.assignments a2 LEFT JOIN FETCH a2.teacher LEFT JOIN FETCH a2.group WHERE a.teacher.id = :teacherId AND s.scheduledDate >= :from ORDER BY s.scheduledDate")
    List<EvangelismSchedule> findUpcomingByTeacherIdWithAssignments(@Param("teacherId") Long teacherId, @Param("from") LocalDate from);

    @Query("SELECT DISTINCT s FROM EvangelismSchedule s JOIN s.assignments a LEFT JOIN FETCH s.assignments a2 LEFT JOIN FETCH a2.teacher LEFT JOIN FETCH a2.group WHERE a.teacher.id = :teacherId ORDER BY s.scheduledDate DESC")
    List<EvangelismSchedule> findAllByTeacherIdWithAssignments(@Param("teacherId") Long teacherId);

}
