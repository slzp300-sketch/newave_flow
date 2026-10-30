package com.newaveflow.repository;
import com.newaveflow.entity.WeeklyReportExport;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
public interface WeeklyReportExportRepository extends JpaRepository<WeeklyReportExport,Long> {
    List<WeeklyReportExport> findByReportDateOrderByCreatedAtDesc(LocalDate date);
}
