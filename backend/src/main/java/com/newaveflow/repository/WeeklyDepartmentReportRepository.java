package com.newaveflow.repository;
import com.newaveflow.entity.WeeklyDepartmentReport;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.Optional;
public interface WeeklyDepartmentReportRepository extends JpaRepository<WeeklyDepartmentReport,Long> {
    Optional<WeeklyDepartmentReport> findByReportDate(LocalDate date);
}
