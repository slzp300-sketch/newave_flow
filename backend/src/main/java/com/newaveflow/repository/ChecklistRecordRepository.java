package com.newaveflow.repository;

import com.newaveflow.entity.ChecklistRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface ChecklistRecordRepository extends JpaRepository<ChecklistRecord, Long> {
    List<ChecklistRecord> findByTeacherIdAndRecordDate(Long teacherId, LocalDate recordDate);
}
