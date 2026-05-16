package com.newaveflow.service;

import com.newaveflow.dto.event.EventDto;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EventService {

    private final EventRepository eventRepository;
    private final EventAttendanceRepository eventAttendanceRepository;
    private final EventStudentAttendanceRepository eventStudentAttendanceRepository;
    private final UserRepository userRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final StudentRepository studentRepository;
    private final NotificationService notificationService;

    public List<EventDto.EventResponse> getEvents(LocalDate from, LocalDate to) {
        if (from == null) from = LocalDate.now().minusMonths(6);
        if (to == null) to = LocalDate.now().plusMonths(6);
        return eventRepository.findByDateRange(from, to)
                .stream()
                .map(EventDto.EventResponse::from)
                .toList();
    }

    public EventDto.EventResponse getEvent(Long id) {
        return EventDto.EventResponse.from(
                eventRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Event not found")));
    }

    public List<EventDto.EventResponse> getAttendanceRequiredEvents() {
        return eventRepository.findByAttendanceRequiredTrueOrderByEventDateDesc()
                .stream()
                .map(EventDto.EventResponse::from)
                .toList();
    }

    @Transactional
    public EventDto.EventResponse createEvent(EventDto.EventCreateRequest request) {
        Event.AttendanceTarget target = parseAttendanceTarget(request.attendanceTarget());
        Event event = Event.builder()
                .title(request.title())
                .description(request.description())
                .eventDate(request.eventDate())
                .endDate(request.endDate() != null ? request.endDate() : request.eventDate())
                .startTime(request.startTime())
                .endTime(request.endTime())
                .color(request.color())
                .eventType(Event.EventType.valueOf(request.eventType()))
                .attendanceRequired(Boolean.TRUE.equals(request.attendanceRequired()))
                .attendanceDeadline(Boolean.TRUE.equals(request.attendanceRequired()) ? request.attendanceDeadline() : null)
                .attendanceTarget(target)
                .build();
        Event saved = eventRepository.save(event);

        // 새 일정 등록 시 교사들에게 알림 (SYSTEM 또는 EVENT)
        List<Long> activeUserIds = userRepository.findByIsActiveTrue().stream().map(User::getId).toList();
        notificationService.createNotificationForUsers(activeUserIds, 
                "새로운 부서 일정", 
                "새로운 일정 '" + request.title() + "' 이(가) 등록되었습니다.", 
                Notification.NotificationType.EVENT);

        return EventDto.EventResponse.from(saved);
    }

    @Transactional
    public EventDto.EventResponse updateEvent(Long id, EventDto.EventCreateRequest request) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Event not found"));
        event.setTitle(request.title());
        event.setDescription(request.description());
        event.setEventDate(request.eventDate());
        event.setEndDate(request.endDate() != null ? request.endDate() : request.eventDate());
        event.setStartTime(request.startTime());
        event.setEndTime(request.endTime());
        event.setColor(request.color());
        event.setEventType(Event.EventType.valueOf(request.eventType()));
        event.setAttendanceRequired(Boolean.TRUE.equals(request.attendanceRequired()));
        event.setAttendanceDeadline(Boolean.TRUE.equals(request.attendanceRequired()) ? request.attendanceDeadline() : null);
        event.setAttendanceTarget(parseAttendanceTarget(request.attendanceTarget()));
        return EventDto.EventResponse.from(eventRepository.save(event));
    }

    @Transactional
    public void deleteEvent(Long id) {
        eventStudentAttendanceRepository.deleteAllByEventId(id);
        eventAttendanceRepository.deleteAllByEventId(id);
        eventRepository.deleteById(id);
    }

    // ── 학생 출석 조회 (교사: 내 반) ──
    public List<EventDto.StudentAttendanceRecord> getMyClassAttendance(Long eventId, Long teacherId) {
        List<TeacherClass> teacherClasses = teacherClassRepository.findByTeacherId(teacherId);
        if (teacherClasses.isEmpty()) return List.of();

        TeacherClass primary = teacherClasses.stream()
                .filter(TeacherClass::isPrimary)
                .findFirst()
                .orElse(teacherClasses.get(0));

        Long classGroupId = primary.getClassGroup().getId();
        String classGroupName = primary.getClassGroup().getName();

        List<Student> students = studentRepository.findByClassGroupIdAndIsActiveTrue(classGroupId);

        Map<Long, EventStudentAttendance> attMap = eventStudentAttendanceRepository
                .findByEventIdAndClassGroupId(eventId, classGroupId)
                .stream()
                .collect(Collectors.toMap(a -> a.getStudent().getId(), a -> a));

        return students.stream()
                .map(s -> {
                    EventStudentAttendance att = attMap.get(s.getId());
                    return new EventDto.StudentAttendanceRecord(
                        s.getId(), s.getName(), s.getGrade(),
                        classGroupId, classGroupName,
                        att != null ? att.getStatus() : null,
                        att != null ? att.getAbsenceReason() : null,
                        att != null ? att.getPartialFromDate() : null,
                        att != null ? att.getPartialNote() : null);
                })
                .toList();
    }

    // ── 학생 출석 배치 저장 (교사) ──
    @Transactional
    public void saveStudentAttendanceBatch(Long eventId, Long teacherId, List<EventDto.StudentAttendanceItem> items) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> AppException.notFound("행사를 찾을 수 없습니다."));
        if (event.getAttendanceDeadline() != null && java.time.LocalDate.now().isAfter(event.getAttendanceDeadline())) {
            throw AppException.badRequest("출석 제출 기한이 마감되었습니다.");
        }
        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> AppException.notFound("교사를 찾을 수 없습니다."));

        for (EventDto.StudentAttendanceItem item : items) {
            Student student = studentRepository.findById(item.studentId())
                    .orElseThrow(() -> AppException.notFound("학생을 찾을 수 없습니다."));

            Optional<EventStudentAttendance> existing =
                    eventStudentAttendanceRepository.findByEventIdAndStudentId(eventId, item.studentId());

            if (existing.isPresent()) {
                existing.get().update(item.status(), item.absenceReason(),
                        item.partialFromDate(), item.partialNote());
                eventStudentAttendanceRepository.save(existing.get());
            } else {
                eventStudentAttendanceRepository.save(
                        EventStudentAttendance.builder()
                                .event(event)
                                .student(student)
                                .teacher(teacher)
                                .status(item.status())
                                .absenceReason(item.absenceReason())
                                .partialFromDate(item.partialFromDate())
                                .partialNote(item.partialNote())
                                .build()
                );
            }
        }
    }

    // ── 교사 본인 출석 조회 ──
    public EventDto.TeacherAttendanceStatusResponse getMyTeacherAttendance(Long eventId, Long teacherId) {
        return eventAttendanceRepository.findByEventIdAndTeacherId(eventId, teacherId)
                .map(a -> new EventDto.TeacherAttendanceStatusResponse(
                        a.getStatus(), a.getPartialFromDate(), a.getPartialNote(), a.getAbsenceReason()))
                .orElse(new EventDto.TeacherAttendanceStatusResponse(null, null, null, null));
    }

    // ── 교사 본인 출석 저장 ──
    @Transactional
    public void saveTeacherAttendance(Long eventId, Long teacherId,
                                      String status, java.time.LocalDate partialFromDate, String partialNote, String absenceReason) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> AppException.notFound("행사를 찾을 수 없습니다."));
        if (event.getAttendanceDeadline() != null && java.time.LocalDate.now().isAfter(event.getAttendanceDeadline())) {
            throw AppException.badRequest("출석 제출 기한이 마감되었습니다.");
        }
        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> AppException.notFound("교사를 찾을 수 없습니다."));

        Optional<EventAttendance> existing = eventAttendanceRepository.findByEventIdAndTeacherId(eventId, teacherId);
        if (existing.isPresent()) {
            existing.get().update(status, partialFromDate, partialNote, absenceReason);
            eventAttendanceRepository.save(existing.get());
        } else {
            eventAttendanceRepository.save(
                    EventAttendance.builder()
                            .event(event)
                            .teacher(teacher)
                            .status(status)
                            .partialFromDate(partialFromDate)
                            .partialNote(partialNote)
                            .absenceReason(absenceReason)
                            .build()
            );
        }
    }

    // ── 교사 출석 전체 요약 (관리자) ──
    public List<EventDto.TeacherAttendanceRecord> getTeacherAttendanceSummary(Long eventId) {
        // 실제 출석 기록이 있는 사람 (역할 무관) + TEACHER 롤 전체 (미제출 포함)
        List<EventAttendance> records = eventAttendanceRepository.findAllByEventIdWithTeacher(eventId);
        Map<Long, EventAttendance> attendanceMap = records.stream()
                .collect(Collectors.toMap(a -> a.getTeacher().getId(), a -> a));

        // TEACHER 및 EXECUTIVE 롤 전체 (미제출자 포함)
        List<User> teachers = userRepository.findByIsActiveTrue().stream()
                .filter(u -> u.getRole() == User.Role.TEACHER || u.getRole() == User.Role.EXECUTIVE)
                .toList();

        // 출석 제출한 사람 중 TEACHER가 아닌 사람 (EXECUTIVE, PASTOR 등) 추가 — ADMIN 제외
        Set<Long> teacherIds = teachers.stream().map(User::getId).collect(Collectors.toSet());
        List<User> extraSubmitters = records.stream()
                .map(EventAttendance::getTeacher)
                .filter(u -> !teacherIds.contains(u.getId()))
                .filter(u -> u.getRole() != User.Role.ADMIN)
                .distinct()
                .toList();

        // 합산 목록 구성
        List<User> allUsers = new java.util.ArrayList<>(teachers);
        allUsers.addAll(extraSubmitters);

        // 교사들의 반 배정 정보 조회 (한 번에 조회하여 성능 최적화)
        List<TeacherClass> allTeacherClasses = teacherClassRepository.findAllWithTeacherAndClass();
        Map<Long, String> teacherGradeMap = allTeacherClasses.stream()
                .filter(TeacherClass::isPrimary)
                .collect(Collectors.toMap(
                        tc -> tc.getTeacher().getId(),
                        tc -> {
                            String desc = tc.getClassGroup().getDescription();
                            return (desc != null && !desc.isBlank()) ? desc : tc.getClassGroup().getName();
                        },
                        (v1, v2) -> v1
                ));

        return allUsers.stream()
                .map(t -> {
                    String grade = t.getGrade();
                    if (grade == null || grade.isBlank()) {
                        grade = teacherGradeMap.get(t.getId());
                    }
                    EventAttendance att = attendanceMap.get(t.getId());
                    return new EventDto.TeacherAttendanceRecord(
                            t.getId(), t.getName(), grade,
                            att != null ? att.getStatus() : null,
                            att != null ? att.getPartialFromDate() : null,
                            att != null ? att.getPartialNote() : null,
                            att != null ? att.getAbsenceReason() : null
                    );
                })
                .sorted(Comparator.comparing(r -> r.teacherName() != null ? r.teacherName() : ""))
                .toList();
    }

    private Event.AttendanceTarget parseAttendanceTarget(String value) {
        if (value == null) return Event.AttendanceTarget.STUDENT_ONLY;
        try { return Event.AttendanceTarget.valueOf(value); }
        catch (IllegalArgumentException e) { return Event.AttendanceTarget.STUDENT_ONLY; }
    }

    // ── 학생 출석 전체 요약 (관리자) ──
    public List<EventDto.ClassAttendanceSummary> getStudentAttendanceSummary(Long eventId) {
        // 제출된 출석 기록을 studentId 기준으로 맵핑
        Map<Long, EventStudentAttendance> submittedMap = eventStudentAttendanceRepository
                .findAllByEventId(eventId).stream()
                .collect(Collectors.toMap(a -> a.getStudent().getId(), a -> a));

        // 전체 활성 학생(반 배정된 학생)을 반별로 그룹화
        return studentRepository.findAllActiveWithClassGroup().stream()
                .collect(Collectors.groupingBy(Student::getClassGroup))
                .entrySet().stream()
                .map(entry -> {
                    ClassGroup cg = entry.getKey();
                    List<Student> students = entry.getValue();
                    List<EventDto.StudentAttendanceRecord> records = students.stream()
                            .sorted(Comparator.comparing(Student::getName))
                            .map(s -> {
                                EventStudentAttendance att = submittedMap.get(s.getId());
                                return new EventDto.StudentAttendanceRecord(
                                        s.getId(), s.getName(), s.getGrade(),
                                        cg.getId(), cg.getName(),
                                        att != null ? att.getStatus() : null,
                                        att != null ? att.getAbsenceReason() : null,
                                        att != null ? att.getPartialFromDate() : null,
                                        att != null ? att.getPartialNote() : null);
                            })
                            .toList();
                    long presentCount = records.stream()
                            .filter(r -> "PRESENT".equals(r.status()) || "PARTIAL".equals(r.status())).count();
                    long absentCount = records.stream()
                            .filter(r -> "ABSENT".equals(r.status())).count();
                    return new EventDto.ClassAttendanceSummary(
                            cg.getId(), cg.getName(),
                            students.size(), presentCount, absentCount,
                            records);
                })
                .sorted(Comparator.comparing(EventDto.ClassAttendanceSummary::classGroupName))
                .toList();
    }
}
