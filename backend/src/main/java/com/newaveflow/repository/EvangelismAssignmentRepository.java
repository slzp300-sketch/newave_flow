package com.newaveflow.repository;

import com.newaveflow.entity.EvangelismAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EvangelismAssignmentRepository extends JpaRepository<EvangelismAssignment, Long> {

    List<EvangelismAssignment> findByScheduleId(Long scheduleId);

    void deleteByScheduleId(Long scheduleId);
}
