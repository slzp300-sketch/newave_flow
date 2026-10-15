package com.newaveflow.repository;

import com.newaveflow.entity.ContentReport;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.Optional;

public interface ContentReportRepository extends JpaRepository<ContentReport, Long> {
    Optional<ContentReport> findByReporterIdAndRequestId(Long reporterId, String requestId);
    long countByReporterIdAndCreatedAtAfter(Long reporterId, LocalDateTime since);
    Page<ContentReport> findByReporterId(Long reporterId, Pageable pageable);
    Page<ContentReport> findByStatus(ContentReport.Status status, Pageable pageable);
    long countByStatus(ContentReport.Status status);
    long countByResolvedAtIsNullAndDueAtBefore(LocalDateTime now);
    long countByResolvedAtIsNullAndUrgentTrue();
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from ContentReport r where r.id = :id")
    Optional<ContentReport> lockById(@Param("id") Long id);
}
