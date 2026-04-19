package com.newaveflow.service;

import com.newaveflow.dto.attendance.AttendanceBatchRequest;
import com.newaveflow.dto.attendance.AttendanceResponse;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AttendanceService {

    private final AttendanceRepository attendanceRepository;
    private final StudentRepository    studentRepository;
    private final ClassGroupRepository classGroupRepository;
    private final UserRepository       userRepository;
    private final DailyReportRepository dailyReportRepository;

    public List<AttendanceResponse> getByClassAndDate(Long classId, LocalDate date) {
        return attendanceRepository.findByClassAndDate(classId, date)
                .stream().map(AttendanceResponse::from).toList();
    }

    @Transactional
    public int saveBatch(AttendanceBatchRequest request, Long teacherId) {
        ClassGroup classGroup = classGroupRepository.findById(request.classGroupId())
                .orElseThrow(() -> AppException.notFound("반을 찾을 수 없습니다."));
        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> AppException.notFound("교사를 찾을 수 없습니다."));

        // 기존 출석 기록 조회 (upsert 처리)
        Map<Long, Attendance> existingMap = attendanceRepository
                .findByClassGroupIdAndAttendanceDate(request.classGroupId(), request.attendanceDate())
                .stream().collect(Collectors.toMap(a -> a.getStudent().getId(), a -> a));

        for (AttendanceBatchRequest.Record rec : request.records()) {
            Attendance.Status status = Attendance.Status.valueOf(rec.status());

            if (existingMap.containsKey(rec.studentId())) {
                existingMap.get(rec.studentId()).updateStatus(status, rec.absentReason(), rec.note());
            } else {
                Student student = studentRepository.findById(rec.studentId())
                        .orElseThrow(() -> AppException.notFound("학생을 찾을 수 없습니다."));
                attendanceRepository.save(
                        Attendance.builder()
                                .student(student)
                                .classGroup(classGroup)
                                .teacher(teacher)
                                .attendanceDate(request.attendanceDate())
                                .status(status)
                                .absentReason(rec.absentReason())
                                .note(rec.note())
                                .build()
                );
            }
        }
        
        updateDailyReport(classGroup, teacher, request.attendanceDate());
        
        return request.records().size();
    }

    @Transactional
    public void submitReport(Long classId, LocalDate date, Long teacherId) {
        DailyReport report = dailyReportRepository.findByTeacherIdAndClassGroupIdAndReportDate(teacherId, classId, date)
                .orElseThrow(() -> AppException.notFound("보고서를 찾을 수 없습니다. 출석을 먼저 입력해주세요."));
        
        report.submit();
    }

    private void updateDailyReport(ClassGroup classGroup, User teacher, LocalDate date) {
        List<Attendance> attendances = attendanceRepository.findByClassGroupIdAndAttendanceDate(classGroup.getId(), date);
        
        int total = attendances.size();
        int present = (int) attendances.stream().filter(a -> a.getStatus() == Attendance.Status.PRESENT).count();
        int absent = (int) attendances.stream().filter(a -> a.getStatus() == Attendance.Status.ABSENT).count();
        int late = (int) attendances.stream().filter(a -> a.getStatus() == Attendance.Status.LATE).count();

        DailyReport report = dailyReportRepository.findByTeacherIdAndClassGroupIdAndReportDate(teacher.getId(), classGroup.getId(), date)
                .orElseGet(() -> DailyReport.builder()
                        .teacher(teacher)
                        .classGroup(classGroup)
                        .reportDate(date)
                        .status(DailyReport.Status.DRAFT)
                        .build());
        
        report.updateCounts(total, present, absent, late, "");
        dailyReportRepository.save(report);
    }

    public List<AttendanceResponse> getStudentAttendanceHistory(Long studentId) {
        return attendanceRepository.findByStudentIdOrderByAttendanceDateDesc(studentId)
                .stream().map(AttendanceResponse::from).toList();
    }

    public boolean isSubmissionWindowOpen() {
        LocalDate now = LocalDate.now();
        java.time.DayOfWeek day = now.getDayOfWeek();
        return day == java.time.DayOfWeek.SUNDAY || day == java.time.DayOfWeek.MONDAY;
    }
}
