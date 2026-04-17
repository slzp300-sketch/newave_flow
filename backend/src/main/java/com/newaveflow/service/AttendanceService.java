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
                existingMap.get(rec.studentId()).updateStatus(status, rec.note());
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
                                .note(rec.note())
                                .build()
                );
            }
        }
        return request.records().size();
    }

    public List<AttendanceResponse> getStudentAttendanceHistory(Long studentId) {
        return attendanceRepository.findByStudentIdOrderByAttendanceDateDesc(studentId)
                .stream().map(AttendanceResponse::from).toList();
    }
}
