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
    private final ClassAccessService classAccessService;

    @Transactional
    public DailyReport saveOrUpdate(ReportRequest request, Long teacherId) {
        if (request.reportDate().isAfter(LocalDate.now())) throw AppException.badRequest("미래 날짜는 저장할 수 없습니다.");
        ClassGroup classGroup = classGroupRepository.lockById(request.classGroupId())
                .orElseThrow(() -> AppException.notFound("반을 찾을 수 없습니다."));
        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> AppException.notFound("교사를 찾을 수 없습니다."));
        classAccessService.requireClass(teacher, classGroup.getId());

        // 출석 집계 자동 계산
        List<Attendance> records = attendanceRepository
                .findByClassGroupIdAndAttendanceDate(request.classGroupId(), request.reportDate());
        int total   = records.size();
        int present = (int) records.stream().filter(a -> a.getStatus() == Attendance.Status.PRESENT).count();
        int late    = (int) records.stream().filter(a -> a.getStatus() == Attendance.Status.LATE).count();
        int absent  = (int) records.stream().filter(a -> a.getStatus() == Attendance.Status.ABSENT).count();

        DailyReport report = reportRepository
                .findFirstByClassGroupIdAndReportDateOrderByIdAsc(request.classGroupId(), request.reportDate())
                .orElseGet(() -> DailyReport.builder()
                        .teacher(teacher)
                        .classGroup(classGroup)
                        .reportDate(request.reportDate())
                        .build());

        report.recordEditor(teacher);
        report.updateCounts(total, present, absent, late, request.specialNotes());
        return reportRepository.save(report);
    }

    @Transactional
    public DailyReport submit(Long reportId, Long teacherId) {
        DailyReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> AppException.notFound("보고서를 찾을 수 없습니다."));

        classGroupRepository.lockById(report.getClassGroup().getId()).orElseThrow(() -> AppException.notFound("반을 찾을 수 없습니다."));
        User teacher = userRepository.findById(teacherId).orElseThrow(() -> AppException.unauthorized("교사를 찾을 수 없습니다."));
        classAccessService.requireClass(teacher, report.getClassGroup().getId());
        report.recordEditor(teacher);
        report.submit();
        return report;
    }

    public ReportSummaryResponse getSummary(LocalDate date) {
        List<DailyReport> allReports = reportRepository.findByDateWithDetails(date);
        
        // N+1 문제 해결: 모든 활성 교사와 그들의 반 배정 정보를 한 번의 쿼리로 가져옵니다.
        List<User> targetTeachers = userRepository.findAllActiveWithClasses().stream()
                .filter(u -> u.getRole() == User.Role.TEACHER || u.getRole() == User.Role.EXECUTIVE)
                .toList();

        java.util.Set<Long> submittedClassIds = allReports.stream()
                .filter(r -> r.getStatus() == DailyReport.Status.SUBMITTED)
                .map(r -> r.getClassGroup().getId())
                .collect(java.util.stream.Collectors.toSet());

        List<Long> submittedTeacherIds = targetTeachers.stream()
                .filter(t -> t.getTeacherClasses() != null && !t.getTeacherClasses().isEmpty()
                    && t.getTeacherClasses().stream().allMatch(tc -> submittedClassIds.contains(tc.getClassGroup().getId())))
                .map(User::getId).toList();
        long submitted = submittedTeacherIds.size();

        List<ReportSummaryResponse.NotSubmittedTeacher> notSubmitted = targetTeachers.stream()
                .filter(u -> !submittedTeacherIds.contains(u.getId()))
                .map(u -> {
                    String className = "미배정";
                    if (u.getTeacherClasses() != null && !u.getTeacherClasses().isEmpty()) {
                        className = u.getTeacherClasses().get(0).getClassGroup().getName();
                    }
                    return new ReportSummaryResponse.NotSubmittedTeacher(
                            u.getId(),
                            u.getName(),
                            className);
                })
                .toList();

        return new ReportSummaryResponse(
                date, targetTeachers.size(), submitted, notSubmitted.size(), notSubmitted);
    }
    public DailyReport getByClassAndDate(Long classId, LocalDate date) {
        return reportRepository.findFirstByClassGroupIdAndReportDateOrderByIdAsc(classId, date).orElse(null);
    }
}
