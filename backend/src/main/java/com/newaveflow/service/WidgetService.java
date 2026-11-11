package com.newaveflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.dto.tts.*;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@Service @RequiredArgsConstructor
public class WidgetService {
    public static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    private final UserRepository users;
    private final JwtTokenProvider tokens;
    private final CommunitySafetyService safety;
    private final TtsService tts;
    private final ObjectMapper json;
    private final EventService events;
    private final EventRepository eventRepository;
    private final TeacherClassRepository classes;
    private final DailyReportRepository reports;
    private final PrayerVoteRepository prayers;
    private final MeetingAttendanceRepository meetings;
    private final MeetingMinuteRepository minutes;
    private final MeetingMinuteConfirmRepository confirms;
    private Clock clock = Clock.system(ZONE);

    public record Check(Long id, String title, boolean checked) {}
    public record Task(String id, String title, String state, String path) {}
    public record Schedule(String title, LocalDate date, String time, String path) {}
    public record Snapshot(int schemaVersion, long revision, String generatedAt, LocalDate date, String validUntil,
                           List<Schedule> events, List<Check> checks, List<Task> tasks, List<LocalDate> calendarDates) {}
    public record Session(String token, String expiresAt, Snapshot snapshot) {}
    public record CheckInput(LocalDate date, Long questionId, Boolean checked, Boolean expectedChecked) {}

    private User eligible(User user) {
        if (user == null || !user.isActive() || user.isSuspended()) throw AppException.unauthorized("앱에서 다시 로그인해주세요.");
        safety.requireAgreement(user.getId());
        return user;
    }
    private User authenticate(String token, boolean lock) {
        try {
            var claims = tokens.requireToken(token, "widget");
            Long id = Long.valueOf(claims.getSubject());
            var user = (lock ? users.lockById(id) : users.findById(id)).orElseThrow(() -> AppException.unauthorized("앱에서 다시 로그인해주세요."));
            if (!tokens.matchesUser(claims, user)) throw AppException.unauthorized("앱에서 다시 로그인해주세요.");
            return eligible(user);
        } catch (io.jsonwebtoken.JwtException | IllegalArgumentException e) {
            throw AppException.unauthorized("앱에서 다시 로그인해주세요.");
        }
    }
    @Transactional
    public Session connect(User caller) {
        var user = eligible(users.lockById(caller.getId()).orElse(null));
        String token = tokens.createWidgetToken(user);
        return new Session(token, tokens.getClaims(token).getExpiration().toInstant().toString(), snapshot(user));
    }
    @Transactional
    public Snapshot read(String token) { return snapshot(authenticate(token, true)); }
    @Transactional(readOnly = true)
    public Snapshot preview(User user) { return snapshot(eligible(user)); }

    @Transactional
    public Snapshot check(String token, CheckInput input) {
        var user = authenticate(token, true); // Same lock as logout and TTS writes.
        if (!user.participatesInTeacherActivities()) throw AppException.forbidden("개인 체크 대상이 아닙니다.");
        LocalDate today = LocalDate.now(clock);
        if (input.date() == null || !today.equals(input.date()) || input.questionId() == null
                || input.checked() == null || input.expectedChecked() == null)
            throw AppException.badRequest("날짜가 바뀌었어요. 최신 체크를 확인해주세요.");
        var week = tts.getWeek(user, today);
        var check = todayChecks(week, today).stream().filter(c -> c.id().equals(input.questionId())).findFirst()
                .orElseThrow(() -> AppException.forbidden("앱에서 이 항목을 확인해주세요."));
        if (check.checked() == input.checked()) return snapshot(user); // Duplicate desired state is harmless.
        if (check.checked() != input.expectedChecked()) throw AppException.conflict("앱에서 변경된 기록이 있어요. 새로 확인해주세요.");
        String day = today.getDayOfWeek() == DayOfWeek.SUNDAY ? null : TtsService.DAY_LABELS.get(today.getDayOfWeek().getValue() - 1);
        tts.saveFields(user, new TtsFieldAnswerRequest(week.getWeekStart(), input.questionId(),
                day == null ? null : Map.of(day, input.checked()), day == null ? input.checked() : null));
        return snapshot(user);
    }
    private List<Check> todayChecks(TtsResponse week, LocalDate today) {
        if (week.isImportedPeriod() || week.isClosedQuarter()) return List.of();
        boolean sunday = today.getDayOfWeek() == DayOfWeek.SUNDAY;
        String day = sunday ? null : TtsService.DAY_LABELS.get(today.getDayOfWeek().getValue() - 1);
        if (sunday ? !week.isAttendanceEditable() : !week.getEditableDays().contains(day)) return List.of();
        return tts.getActiveQuestions(today).stream().filter(q -> q.isActive()
                && (q.getLinkType() == null || q.getLinkType() == TtsQuestion.TtsLinkType.NONE)
                && q.getType() == (sunday ? TtsQuestion.TtsQuestionType.ATTEND : TtsQuestion.TtsQuestionType.DAYS))
                .map(q -> {
                    String raw = week.getAnswers().stream().filter(a -> q.getId().equals(a.getQuestionId()))
                            .map(TtsResponse.AnswerResponse::getAnswerData).findFirst().orElse("null");
                    boolean done = false;
                    try { var value = json.readTree(raw); done = day == null ? value.asBoolean(false) : value.path(day).asBoolean(false); }
                    catch (Exception ignored) { /* Legacy malformed values are never completed. */ }
                    return new Check(q.getId(), q.getTitle(), done);
                }).toList();
    }
    private Snapshot snapshot(User user) {
        LocalDate today = LocalDate.now(clock);
        var upcoming = events.getEvents(today, today.plusMonths(3)).stream()
                .sorted(Comparator.comparing((com.newaveflow.dto.event.EventDto.EventResponse e) -> e.eventDate().isBefore(today) ? today : e.eventDate())
                        .thenComparing(e -> Objects.toString(e.startTime(), "")))
                .limit(3).map(e -> new Schedule(e.title(), e.eventDate(), Objects.toString(e.startTime(), ""), "/calendar?date="+e.eventDate())).toList();
        var generated = clock.instant();
        return new Snapshot(1, generated.getEpochSecond()*1_000_000+generated.getNano()/1000, generated.toString(), today, today.plusDays(1).atStartOfDay(ZONE).toInstant().toString(),
                upcoming, user.participatesInTeacherActivities() ? todayChecks(tts.getWeek(user, today), today) : List.of(),
                user.participatesInTeacherActivities() ? weeklyTasks(user, today) : List.of(), calendarDates(today));
    }
    // A bounded month of date markers, including past and multi-day church events.
    // Keep event descriptions and participant details outside the widget snapshot.
    private List<LocalDate> calendarDates(LocalDate today) {
        LocalDate first = today.withDayOfMonth(1), last = today.withDayOfMonth(today.lengthOfMonth());
        var dates = new TreeSet<LocalDate>();
        for (var event : events.getEvents(first, last)) {
            LocalDate start = event.eventDate().isBefore(first) ? first : event.eventDate();
            LocalDate end = event.endDate() == null ? event.eventDate() : event.endDate();
            if (end.isAfter(last)) end = last;
            for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) dates.add(day);
        }
        return List.copyOf(dates);
    }
    private List<Task> weeklyTasks(User user, LocalDate today) {
        LocalDate sunday = TtsService.weekSunday(today), monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        var classIds = classes.findByTeacherId(user.getId()).stream().map(c -> c.getClassGroup().getId()).distinct().toList();
        var submitted = classIds.isEmpty() ? List.<DailyReport>of() : reports.findByClassGroupIdInAndReportDateBetween(classIds, sunday, sunday.plusDays(6));
        String attendance = classIds.isEmpty() ? "none" : state(classIds.stream().allMatch(id -> submitted.stream()
                .anyMatch(r -> r.getClassGroup().getId().equals(id) && r.getReportDate().equals(sunday) && r.isSubmissionComplete())));
        var published = minutes.findAllByIsActiveTrueOrderByMeetingDateDesc().stream().filter(m -> !m.getMeetingDate().isAfter(today)).toList();
        var dates = published.stream().map(MeetingMinute::getMeetingDate).distinct().toList();
        var absentDates = new HashSet<LocalDate>();
        if (!dates.isEmpty()) meetings.findByTeacherIdAndMeetingDateIn(user.getId(), dates).stream()
                .filter(a -> "ABSENT".equals(a.getStatus())).forEach(a -> absentDates.add(a.getMeetingDate()));
        var relevantMinutes = published.stream().filter(m -> absentDates.contains(m.getMeetingDate())).toList();
        var confirmed = new HashSet<>(confirms.findConfirmedMinuteIds(user.getId()));
        String minuteState = relevantMinutes.isEmpty() ? "none" : state(relevantMinutes.stream().allMatch(m -> confirmed.contains(m.getId())));
        var openEvents = eventRepository.findByAttendanceRequiredTrueOrderByEventDateDesc().stream()
                .filter(e -> !today.isAfter(EventAttendanceWindow.deadline(e)) && (e.getAttendanceStartDate() == null || !today.isBefore(e.getAttendanceStartDate()))).toList();
        String eventState = openEvents.isEmpty() ? "none" : state(openEvents.stream().allMatch(e -> {
            var target = e.getAttendanceTarget();
            boolean teacher = target == Event.AttendanceTarget.TEACHER_ONLY || target == Event.AttendanceTarget.BOTH;
            boolean student = target != Event.AttendanceTarget.TEACHER_ONLY;
            return (!teacher || events.getMyTeacherAttendance(e.getId(), user.getId()).status() != null)
                    && (!student || events.getMyClassAttendance(e.getId(), user.getId()).stream().allMatch(s -> s.status() != null));
        }));
        return List.of(new Task("attendance", "우리 반 출석", attendance, "/attendance"),
                new Task("prayer", "기도모임 투표", state(prayers.findByTeacherIdAndWeekStart(user.getId(), monday).isPresent()), "/meeting/prayer"),
                new Task("meeting", "교사회의 체크", state(meetings.findByTeacherIdAndMeetingDate(user.getId(), monday.plusDays(5)).filter(m -> m.getStatus() != null).isPresent()), "/meeting/sat"),
                new Task("minutes", "회의록 및 영상", minuteState, "/minutes"),
                new Task("event", "행사 출석", eventState, openEvents.size() == 1 ? "/event-attendance/"+openEvents.get(0).getId() : "/event-attendance"));
    }
    private String state(boolean done) { return done ? "done" : "pending"; }
}
