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

    @Query("SELECT DISTINCT s FROM EvangelismSchedule s LEFT JOIN FETCH s.assignments a LEFT JOIN FETCH a.teacher LEFT JOIN FETCH a.group WHERE s.responsibleGroup.id = :groupId AND s.scheduledDate >= :from ORDER BY s.scheduledDate")
    List<EvangelismSchedule> findUpcomingByGroupId(@Param("groupId") Long groupId, @Param("from") LocalDate from);

    @Query("SELECT DISTINCT s FROM EvangelismSchedule s LEFT JOIN FETCH s.assignments a LEFT JOIN FETCH a.teacher LEFT JOIN FETCH a.group WHERE s.responsibleGroup.id = :groupId ORDER BY s.scheduledDate DESC")
    List<EvangelismSchedule> findAllByGroupId(@Param("groupId") Long groupId);

}
