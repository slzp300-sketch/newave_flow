package com.newaveflow.service;

import com.newaveflow.dto.attendance.AttendanceBatchRequest;
import com.newaveflow.dto.attendance.AttendanceResponse;
import com.newaveflow.dto.attendance.AdminWeeklyAttendanceDto;
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
    private final TeacherClassRepository teacherClassRepository;
    private final ClassAccessService classAccessService;

    public List<AttendanceResponse> getByClassAndDate(Long classId, LocalDate date) {
        return attendanceRepository.findByClassAndDate(classId, date)
                .stream().map(AttendanceResponse::from).toList();
    }

    @Transactional
    public int saveBatch(AttendanceBatchRequest request, Long teacherId) {
        // 이번 주일과 지난 주일들은 언제든 수정 가능, 미래 날짜만 막는다
        if (request.attendanceDate().isAfter(LocalDate.now())) {
            throw AppException.forbidden("아직 오지 않은 날짜의 출석은 입력할 수 없습니다.");
        }
        ClassGroup classGroup = classGroupRepository.lockById(request.classGroupId())
                .orElseThrow(() -> AppException.notFound("반을 찾을 수 없습니다."));
        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> AppException.notFound("교사를 찾을 수 없습니다."));
        classAccessService.requireClass(teacher, classGroup.getId());

        // 기존 출석 기록 조회 (upsert 처리)
        Map<Long, Attendance> existingMap = attendanceRepository
                .findByClassGroupIdAndAttendanceDate(request.classGroupId(), request.attendanceDate())
                .stream().collect(Collectors.toMap(a -> a.getStudent().getId(), a -> a));

        // N+1 방지: 필요한 학생 정보를 한 번에 조회합니다.
        java.util.List<Long> neededStudentIds = request.records().stream()
                .map(AttendanceBatchRequest.Record::studentId)
                .filter(id -> !existingMap.containsKey(id))
                .toList();
        
        java.util.Map<Long, Student> studentMap = neededStudentIds.isEmpty() ? java.util.Map.of() :
                studentRepository.findAllById(neededStudentIds).stream()
                        .collect(Collectors.toMap(Student::getId, s -> s));

        for (AttendanceBatchRequest.Record rec : request.records()) {
            Student target = existingMap.containsKey(rec.studentId())
                    ? existingMap.get(rec.studentId()).getStudent() : studentMap.get(rec.studentId());
            if (target == null || !target.isActive() || target.getClassGroup() == null
                    || !target.getClassGroup().getId().equals(classGroup.getId())) {
                throw AppException.badRequest("해당 반의 활성 학생만 출석을 저장할 수 있습니다.");
            }
            Attendance.Status status;
            try { status = Attendance.Status.valueOf(rec.status()); }
            catch (RuntimeException e) { throw AppException.badRequest("출석 상태가 올바르지 않습니다."); }

            if (existingMap.containsKey(rec.studentId())) {
                existingMap.get(rec.studentId()).updateStatus(status, rec.absentReason(), rec.note());
            } else {
                Student student = studentMap.get(rec.studentId());
                if (student == null) throw AppException.notFound("학생을 찾을 수 없습니다: " + rec.studentId());
                
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
        classGroupRepository.lockById(classId).orElseThrow(() -> AppException.notFound("반을 찾을 수 없습니다."));
        User teacher = userRepository.findById(teacherId).orElseThrow(() -> AppException.unauthorized("교사를 찾을 수 없습니다."));
        classAccessService.requireClass(teacher, classId);
        DailyReport report = dailyReportRepository.findFirstByClassGroupIdAndReportDateOrderByIdAsc(classId, date)
                .orElseThrow(() -> AppException.notFound("보고서를 찾을 수 없습니다. 출석을 먼저 입력해주세요."));
        
        report.recordEditor(teacher);
        report.submit();
    }

    private void updateDailyReport(ClassGroup classGroup, User teacher, LocalDate date) {
        List<Attendance> attendances = attendanceRepository.findByClassGroupIdAndAttendanceDate(classGroup.getId(), date);
        
        int total = attendances.size();
        int present = (int) attendances.stream().filter(a -> a.getStatus() == Attendance.Status.PRESENT).count();
        int absent = (int) attendances.stream().filter(a -> a.getStatus() == Attendance.Status.ABSENT).count();
        int late = (int) attendances.stream().filter(a -> a.getStatus() == Attendance.Status.LATE).count();

        DailyReport report = dailyReportRepository.findFirstByClassGroupIdAndReportDateOrderByIdAsc(classGroup.getId(), date)
                .orElseGet(() -> DailyReport.builder()
                        .teacher(teacher)
                        .classGroup(classGroup)
                        .reportDate(date)
                        .status(DailyReport.Status.DRAFT)
                        .build());
        
        report.recordEditor(teacher);
        report.updateCounts(total, present, absent, late, report.getSpecialNotes());
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

    // ── 관리자: 주간 결석자 목록 ──
    public List<AdminWeeklyAttendanceDto.AbsentStudent> getAdminAbsentList(LocalDate date) {
        return attendanceRepository.findAbsentByDate(date)
                .stream()
                .map(a -> new AdminWeeklyAttendanceDto.AbsentStudent(
                        a.getClassGroup().getAgeGroup(),
                        a.getClassGroup().getName(),
                        a.getStudent().getName(),
                        a.getStatus().name(),
                        a.getAbsentReason()
                ))
                .toList();
    }

    // ── 관리자: 주간 출석 요약 (반별) ──
    public List<AdminWeeklyAttendanceDto.ClassSummary> getAdminWeeklySummary(LocalDate date) {
        Map<Long, String> primaryNames = teacherClassRepository.findAllWithTeacherAndClass().stream().filter(com.newaveflow.entity.TeacherClass::isPrimary)
                .collect(Collectors.toMap(tc -> tc.getClassGroup().getId(), tc -> tc.getTeacher().getName(), (a,b) -> a));
        return dailyReportRepository.findByDateWithDetails(date)
                .stream()
                .map(r -> {
                    Long classGroupId = r.getClassGroup().getId();
                    String teacherName = primaryNames.get(classGroupId);
                    return new AdminWeeklyAttendanceDto.ClassSummary(
                            classGroupId,
                            r.getClassGroup().getName(),
                            r.getClassGroup().getAgeGroup(),
                            r.getTotalStudents(),
                            r.getPresentCount(),
                            r.getAbsentCount(),
                            r.getStatus() == DailyReport.Status.SUBMITTED,
                            teacherName
                    );
                })
                .toList();
    }
}
