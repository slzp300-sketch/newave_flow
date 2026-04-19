package com.newaveflow.controller;

import com.newaveflow.dto.report.ReportRequest;
import com.newaveflow.dto.report.ReportSummaryResponse;
import com.newaveflow.entity.DailyReport;
import com.newaveflow.entity.User;
import com.newaveflow.service.ReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @PostMapping
    public ResponseEntity<DailyReport> saveReport(
            @Valid @RequestBody ReportRequest request,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(reportService.saveOrUpdate(request, currentUser.getId()));
    }

    @PutMapping("/{id}/submit")
    public ResponseEntity<DailyReport> submitReport(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(reportService.submit(id, currentUser.getId()));
    }

    @GetMapping("/status")
    public ResponseEntity<DailyReport> getStatus(
            @RequestParam Long classId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(reportService.getByClassAndDate(classId, date));
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('PASTOR', 'EXECUTIVE')")
    public ResponseEntity<ReportSummaryResponse> getSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(reportService.getSummary(date != null ? date : LocalDate.now()));
    }
}
