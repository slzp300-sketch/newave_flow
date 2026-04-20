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
                .build();
        return EventDto.EventResponse.from(eventRepository.save(event));
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

        class StudentStatus {
            String status;
            String reason;
            StudentStatus(String status, String reason) { this.status = status; this.reason = reason; }
        }

        Map<Long, StudentStatus> statusMap = eventStudentAttendanceRepository
                .findByEventIdAndClassGroupId(eventId, classGroupId)
                .stream()
                .collect(Collectors.toMap(
                    a -> a.getStudent().getId(), 
                    a -> new StudentStatus(a.getStatus(), a.getAbsenceReason())
                ));

        return students.stream()
                .map(s -> {
                    StudentStatus ss = statusMap.get(s.getId());
                    return new EventDto.StudentAttendanceRecord(
                        s.getId(), s.getName(), s.getGrade(),
                        classGroupId, classGroupName,
                        ss != null ? ss.status : null,
                        ss != null ? ss.reason : null);
                })
                .toList();
    }

    // ── 학생 출석 배치 저장 (교사) ──
    @Transactional
    public void saveStudentAttendanceBatch(Long eventId, Long teacherId, List<EventDto.StudentAttendanceItem> items) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> AppException.notFound("행사를 찾을 수 없습니다."));
        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> AppException.notFound("교사를 찾을 수 없습니다."));

        for (EventDto.StudentAttendanceItem item : items) {
            Student student = studentRepository.findById(item.studentId())
                    .orElseThrow(() -> AppException.notFound("학생을 찾을 수 없습니다."));

            Optional<EventStudentAttendance> existing =
                    eventStudentAttendanceRepository.findByEventIdAndStudentId(eventId, item.studentId());

            if (existing.isPresent()) {
                existing.get().update(item.status(), item.absenceReason());
                eventStudentAttendanceRepository.save(existing.get());
            } else {
                eventStudentAttendanceRepository.save(
                        EventStudentAttendance.builder()
                                .event(event)
                                .student(student)
                                .teacher(teacher)
                                .status(item.status())
                                .absenceReason(item.absenceReason())
                                .build()
                );
            }
        }
    }

    // ── 학생 출석 전체 요약 (관리자) ──
    public List<EventDto.ClassAttendanceSummary> getStudentAttendanceSummary(Long eventId) {
        List<EventStudentAttendance> all = eventStudentAttendanceRepository.findAllByEventId(eventId);

        return all.stream()
                .collect(Collectors.groupingBy(a -> a.getStudent().getClassGroup()))
                .entrySet().stream()
                .map(entry -> {
                    ClassGroup cg = entry.getKey();
                    List<EventStudentAttendance> recs = entry.getValue();
                    long presentCount = recs.stream().filter(r -> "PRESENT".equals(r.getStatus())).count();
                    List<EventDto.StudentAttendanceRecord> studentRecords = recs.stream()
                            .sorted(Comparator.comparing(r -> r.getStudent().getName()))
                            .map(r -> new EventDto.StudentAttendanceRecord(
                                    r.getStudent().getId(), r.getStudent().getName(),
                                    r.getStudent().getGrade(), cg.getId(), cg.getName(), 
                                    r.getStatus(), r.getAbsenceReason()))
                            .toList();
                    return new EventDto.ClassAttendanceSummary(
                            cg.getId(), cg.getName(),
                            recs.size(), presentCount, recs.size() - presentCount,
                            studentRecords);
                })
                .sorted(Comparator.comparing(EventDto.ClassAttendanceSummary::classGroupName))
                .toList();
    }
}
