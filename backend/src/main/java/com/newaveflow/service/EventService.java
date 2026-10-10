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
    private final EventRosterService roster;
    private final EventParticipantRepository participants;

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

    public List<EventDto.EventResponse> getAllEvents() {
        return eventRepository.findAllByOrderByEventDateAsc()
                .stream()
                .map(EventDto.EventResponse::from)
                .toList();
    }

    public List<EventDto.EventResponse> getAttendanceRequiredEvents() {
        return eventRepository.findByAttendanceRequiredTrueOrderByEventDateDesc()
                .stream()
                .map(EventDto.EventResponse::from)
                .toList();
    }

    @Transactional
    public EventDto.EventResponse createEvent(EventDto.EventCreateRequest request) {
        Event saved = eventRepository.save(buildEvent(request));
        roster.capture(saved);

        // 새 일정 등록 시 교사들에게 알림 (SYSTEM 또는 EVENT)
        List<Long> activeUserIds = userRepository.findByIsActiveTrue().stream().map(User::getId).toList();
        notificationService.createNotificationForUsers(activeUserIds, 
                "새로운 부서 일정", 
                "새로운 일정 '" + request.title() + "' 이(가) 등록되었습니다.", 
                Notification.NotificationType.EVENT);

        return EventDto.EventResponse.from(saved);
    }

    // 여러 일정 한번에 등록 — 하나라도 잘못되면 전부 취소
    @Transactional
    public List<EventDto.EventResponse> createEvents(List<EventDto.EventCreateRequest> requests) {
        List<Event> events = requests.stream().map(this::buildEvent).toList();
        List<Event> saved = eventRepository.saveAll(events);
        saved.forEach(roster::capture);
        return saved.stream()
                .map(EventDto.EventResponse::from)
                .toList();
    }

    private Event buildEvent(EventDto.EventCreateRequest request) {
        InputRules.eventDates(request.title(), request.eventDate(), request.endDate());
        if (request.title().isBlank()) {
            throw AppException.badRequest("일정 제목을 입력해주세요.");
        }
        if (request.endDate() != null && request.endDate().isBefore(request.eventDate())) {
            throw AppException.badRequest("종료일이 시작일보다 빠를 수 없습니다.");
        }
        return Event.builder()
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
                .attendanceTarget(parseAttendanceTarget(request.attendanceTarget()))
                .build();
    }

    @Transactional
    public EventDto.EventResponse updateEvent(Long id, EventDto.EventCreateRequest request) {
        InputRules.eventDates(request.title(), request.eventDate(), request.endDate());
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
        roster.capture(event);
        return EventDto.EventResponse.from(eventRepository.save(event));
    }

    @Transactional
    public void deleteEvent(Long id) {
        participants.deleteByEventId(id);
        eventStudentAttendanceRepository.deleteAllByEventId(id);
        eventAttendanceRepository.deleteAllByEventId(id);
        eventRepository.deleteById(id);
    }

    // ── 학생 출석 조회 (교사: 내 반) ──
    public List<EventDto.StudentAttendanceRecord> getMyClassAttendance(Long eventId, Long teacherId) {
        Set<Long> classIds = teacherClassRepository.findByTeacherId(teacherId).stream()
                .map(tc -> tc.getClassGroup().getId()).collect(Collectors.toSet());
        return roster.studentRecords(eventId).stream().filter(s -> classIds.contains(s.classGroupId())).toList();
    }

    // ── 학생 출석 배치 저장 (교사) ──
    @Transactional
    public void saveStudentAttendanceBatch(Long eventId, Long teacherId, List<EventDto.StudentAttendanceItem> items) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> AppException.notFound("행사를 찾을 수 없습니다."));
        if (event.getAttendanceDeadline() != null && java.time.LocalDate.now().isAfter(event.getAttendanceDeadline())) {
            throw AppException.badRequest("출석 제출 기한이 마감되었습니다.");
        }
        if (!event.isAttendanceRequired() || event.getAttendanceTarget() == Event.AttendanceTarget.TEACHER_ONLY) {
            throw AppException.badRequest("학생 출석 체크 대상 행사가 아닙니다.");
        }
        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> AppException.notFound("교사를 찾을 수 없습니다."));

        // 담당 반 학생만 체크 가능
        Set<Long> myClassIds = teacherClassRepository.findByTeacherId(teacherId).stream()
                .map(tc -> tc.getClassGroup().getId())
                .collect(Collectors.toSet());

        for (EventDto.StudentAttendanceItem item : items) {
            InputRules.eventAttendance(event, item.status(), item.absenceReason(), item.partialFromDate());
            Student student = studentRepository.findById(item.studentId())
                    .orElseThrow(() -> AppException.notFound("학생을 찾을 수 없습니다."));
            if (!myClassIds.contains(roster.student(eventId, student.getId()).getClassGroupId())) {
                throw AppException.forbidden("담당 반 학생만 출석 체크할 수 있습니다.");
            }

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
        if (!event.isAttendanceRequired() || (event.getAttendanceTarget() != Event.AttendanceTarget.TEACHER_ONLY && event.getAttendanceTarget() != Event.AttendanceTarget.BOTH)) {
            throw AppException.badRequest("교사 출석 체크 대상 행사가 아닙니다.");
        }
        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> AppException.notFound("교사를 찾을 수 없습니다."));

        Optional<EventAttendance> existing = eventAttendanceRepository.findByEventIdAndTeacherId(eventId, teacherId);
        InputRules.eventAttendance(event, status, absenceReason, partialFromDate);
        roster.captureExtraTeacher(eventId, teacher);
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
        return roster.teacherSummary(eventId);
    }

    private Event.AttendanceTarget parseAttendanceTarget(String value) {
        if (value == null) return Event.AttendanceTarget.STUDENT_ONLY;
        try { return Event.AttendanceTarget.valueOf(value); }
        catch (IllegalArgumentException e) { return Event.AttendanceTarget.STUDENT_ONLY; }
    }

    // ── 학생 출석 전체 요약 (관리자) ──
    public List<EventDto.ClassAttendanceSummary> getStudentAttendanceSummary(Long eventId) {
        return roster.studentSummary(eventId);
    }
}
