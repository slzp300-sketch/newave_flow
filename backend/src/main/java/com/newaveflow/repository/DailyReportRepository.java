package com.newaveflow.repository;

import com.newaveflow.entity.DailyReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyReportRepository extends JpaRepository<DailyReport, Long> {

    Optional<DailyReport> findByTeacherIdAndClassGroupIdAndReportDate(
            Long teacherId, Long classGroupId, LocalDate date);

    List<DailyReport> findByClassGroupIdAndReportDate(Long classGroupId, LocalDate date);

    List<DailyReport> findByReportDate(LocalDate date);

    @Query("""
        SELECT r FROM DailyReport r
        JOIN FETCH r.teacher t
        JOIN FETCH r.classGroup c
        WHERE r.reportDate = :date
        ORDER BY t.name
        """)
    List<DailyReport> findByDateWithDetails(@Param("date") LocalDate date);

    @Query("""
        SELECT COUNT(r) FROM DailyReport r
        WHERE r.reportDate = :date AND r.status = 'SUBMITTED'
        """)
    long countSubmittedByDate(@Param("date") LocalDate date);

    List<DailyReport> findByTeacherIdAndReportDateBetween(Long teacherId, LocalDate start, LocalDate end);
}
