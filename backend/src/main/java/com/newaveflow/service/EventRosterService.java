package com.newaveflow.service;

import com.newaveflow.dto.event.EventDto;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class EventRosterService {
    private final EventParticipantRepository participants;
    private final StudentRepository students;
    private final UserRepository users;
    private final EventStudentAttendanceRepository studentAttendance;
    private final EventAttendanceRepository teacherAttendance;

    @Transactional
    public void capture(Event event) {
        if (!event.isAttendanceRequired() || event.getRosterCapturedAt() != null) return;
        participants.saveAll(students.findAllActiveWithClassGroup().stream().map(s -> EventParticipant.builder()
                .eventId(event.getId()).kind("STUDENT").personId(s.getId()).name(s.getName()).grade(s.getGrade())
                .classGroupId(s.getClassGroup().getId()).classGroupName(s.getClassGroup().getName()).build()).toList());
        participants.saveAll(users.findAllActiveWithClasses().stream()
                .filter(u -> u.getRole() != User.Role.ADMIN)
                .map(u -> teacherSnapshot(event.getId(), u)).toList());
        event.setRosterCapturedAt(java.time.LocalDateTime.now());
    }

    private EventParticipant teacherSnapshot(Long eventId, User user) {
        String grade = user.getGrade();
        if ((grade == null || grade.isBlank()) && user.getTeacherClasses() != null && !user.getTeacherClasses().isEmpty()) {
            grade = user.getTeacherClasses().get(0).getClassGroup().getAgeGroup();
        }
        return EventParticipant.builder().eventId(eventId).kind("TEACHER").personId(user.getId()).name(user.getName()).grade(grade).build();
    }

    @Transactional
    public void captureExtraTeacher(Long eventId, User user) {
        if (user.getRole() != User.Role.ADMIN && participants.findByEventIdAndKindAndPersonId(eventId,"TEACHER",user.getId()).isEmpty()) {
            throw com.newaveflow.exception.AppException.badRequest("행사 등록 당시 교사 명단에 없습니다. 관리자에게 문의해주세요.");
        }
    }

    public EventParticipant student(Long eventId, Long studentId) {
        return participants.findByEventIdAndKindAndPersonId(eventId,"STUDENT",studentId)
                .orElseThrow(() -> com.newaveflow.exception.AppException.badRequest("행사 등록 당시 명단에 없는 학생입니다."));
    }

    public List<EventDto.StudentAttendanceRecord> studentRecords(Long eventId) {
        var attendance = studentAttendance.findAllByEventId(eventId).stream()
                .collect(Collectors.toMap(a -> a.getStudent().getId(), a -> a));
        return participants.findByEventIdAndKindOrderByName(eventId,"STUDENT").stream().map(s -> {
            var a = attendance.get(s.getPersonId());
            return new EventDto.StudentAttendanceRecord(s.getPersonId(),s.getName(),s.getGrade(),s.getClassGroupId(),s.getClassGroupName(),
                    a == null ? null : a.getStatus(), a == null ? null : a.getAbsenceReason(),
                    a == null ? null : a.getPartialFromDate(), a == null ? null : a.getPartialNote());
        }).toList();
    }

    public List<EventDto.ClassAttendanceSummary> studentSummary(Long eventId) {
        return studentRecords(eventId).stream().collect(Collectors.groupingBy(EventDto.StudentAttendanceRecord::classGroupId))
                .entrySet().stream().map(e -> new EventDto.ClassAttendanceSummary(e.getKey(),e.getValue().get(0).classGroupName(),e.getValue().size(),
                        e.getValue().stream().filter(r -> "PRESENT".equals(r.status()) || "PARTIAL".equals(r.status())).count(),
                        e.getValue().stream().filter(r -> "ABSENT".equals(r.status())).count(),e.getValue()))
                .sorted(Comparator.comparing(EventDto.ClassAttendanceSummary::classGroupName)).toList();
    }

    public List<EventDto.TeacherAttendanceRecord> teacherSummary(Long eventId) {
        var attendance = teacherAttendance.findAllByEventIdWithTeacher(eventId).stream().collect(Collectors.toMap(a -> a.getTeacher().getId(),a -> a));
        return participants.findByEventIdAndKindOrderByName(eventId,"TEACHER").stream().map(t -> {
            var a = attendance.get(t.getPersonId());
            return new EventDto.TeacherAttendanceRecord(t.getPersonId(),t.getName(),t.getGrade(),a == null ? null : a.getStatus(),
                    a == null ? null : a.getPartialFromDate(),a == null ? null : a.getPartialNote(),a == null ? null : a.getAbsenceReason());
        }).toList();
    }
}
