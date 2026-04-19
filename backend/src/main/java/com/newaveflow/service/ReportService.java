package com.newaveflow.service;

import com.newaveflow.dto.report.ReportRequest;
import com.newaveflow.dto.report.ReportSummaryResponse;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportService {

    private final DailyReportRepository  reportRepository;
    private final AttendanceRepository   attendanceRepository;
    private final ClassGroupRepository   classGroupRepository;
    private final UserRepository         userRepository;
    private final StudentRepository      studentRepository;

    @Transactional
    public DailyReport saveOrUpdate(ReportRequest request, Long teacherId) {
        ClassGroup classGroup = classGroupRepository.findById(request.classGroupId())
                .orElseThrow(() -> AppException.notFound("반을 찾을 수 없습니다."));
        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> AppException.notFound("교사를 찾을 수 없습니다."));

        // 출석 집계 자동 계산
        List<Attendance> records = attendanceRepository
                .findByClassGroupIdAndAttendanceDate(request.classGroupId(), request.reportDate());
        int total   = studentRepository.findByClassGroupIdAndIsActiveTrue(request.classGroupId()).size();
        int present = (int) records.stream().filter(a -> a.getStatus() == Attendance.Status.PRESENT).count();
        int late    = (int) records.stream().filter(a -> a.getStatus() == Attendance.Status.LATE).count();
        int absent  = total - present - late;

        DailyReport report = reportRepository
                .findByTeacherIdAndClassGroupIdAndReportDate(teacherId, request.classGroupId(), request.reportDate())
                .orElseGet(() -> DailyReport.builder()
                        .teacher(teacher)
                        .classGroup(classGroup)
                        .reportDate(request.reportDate())
                        .build());

        report.updateCounts(total, present, absent, late, request.specialNotes());
        return reportRepository.save(report);
    }

    @Transactional
    public DailyReport submit(Long reportId, Long teacherId) {
        DailyReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> AppException.notFound("보고서를 찾을 수 없습니다."));

        if (!report.getTeacher().getId().equals(teacherId)) {
            throw AppException.badRequest("본인의 보고서만 제출할 수 있습니다.");
        }
        if (report.getStatus() == DailyReport.Status.SUBMITTED) {
            throw AppException.conflict("이미 제출된 보고서입니다.");
        }

        report.submit();
        return report;
    }

    public ReportSummaryResponse getSummary(LocalDate date) {
        List<DailyReport> allReports = reportRepository.findByDateWithDetails(date);
        long submitted = allReports.stream()
                .filter(r -> r.getStatus() == DailyReport.Status.SUBMITTED).count();

        List<ReportSummaryResponse.NotSubmittedTeacher> notSubmitted = allReports.stream()
                .filter(r -> r.getStatus() == DailyReport.Status.DRAFT)
                .map(r -> new ReportSummaryResponse.NotSubmittedTeacher(
                        r.getTeacher().getId(),
                        r.getTeacher().getName(),
                        r.getClassGroup().getName()))
                .toList();

        return new ReportSummaryResponse(
                date, allReports.size(), submitted, notSubmitted.size(), notSubmitted);
    }
    public DailyReport getByClassAndDate(Long classId, LocalDate date) {
        return reportRepository.findByClassGroupIdAndReportDate(classId, date)
                .stream().findFirst().orElse(null); // Or use findByTeacherId... if multiple teachers per class
    }
}
