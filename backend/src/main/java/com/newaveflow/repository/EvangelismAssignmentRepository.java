package com.newaveflow.repository;

import com.newaveflow.entity.EvangelismAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EvangelismAssignmentRepository extends JpaRepository<EvangelismAssignment, Long> {

    List<EvangelismAssignment> findByScheduleId(Long scheduleId);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM EvangelismAssignment a WHERE a.schedule.id = :scheduleId")
    void deleteByScheduleId(@org.springframework.data.repository.query.Param("scheduleId") Long scheduleId);
}
