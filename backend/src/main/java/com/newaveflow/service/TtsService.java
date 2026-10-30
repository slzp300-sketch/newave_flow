package com.newaveflow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.dto.tts.TtsAnswerRequest;
import com.newaveflow.dto.tts.TtsResponse;
import com.newaveflow.dto.tts.TtsSubmitRequest;
import com.newaveflow.dto.tts.TtsWeekStatsResponse;
import com.newaveflow.entity.*;
import com.newaveflow.entity.TtsQuestion.TtsLinkType;
import com.newaveflow.entity.TtsQuestion.TtsQuestionType;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TtsService {

    // DAYS 항목의 요일 키 (일요일 다음날부터)
    static final List<String> DAY_LABELS = List.of("월", "화", "수", "목", "금", "토");

    private final TtsQuestionRepository questionRepository;
    private final TtsRecordRepository recordRepository;
    private final TtsLegacyScoreRepository legacyScoreRepository;
    private final MeetingAttendanceRepository meetingAttendanceRepository;
    private final PrayerVoteRepository prayerVoteRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final TtsQuestionPolicy questionPolicy;
    private final TtsLinkedSnapshotRepository linkedSnapshotRepository;
    private Clock clock = Clock.system(TtsPeriod.ZONE);

    private LocalDate today() { return LocalDate.now(clock.withZone(TtsPeriod.ZONE)); }

    // ── 주차 계산: 일~토 한 주, 1월 1일이 들어 있는 주가 1주차 (화면의 date-fns getWeek와 동일) ──

    public static LocalDate weekSunday(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
    }

    private static LocalDate firstSunday(int year) {
        return TtsPeriod.firstSunday(year);
    }

    public static int weekYear(LocalDate sunday) {
        return sunday.plusDays(6).getYear();
    }

    public static int weekNum(LocalDate sunday) {
        return (int) (ChronoUnit.DAYS.between(firstSunday(weekYear(sunday)), sunday) / 7) + 1;
    }

    private String resolveTeacherGrade(User teacher) {
        if (teacher.getTeacherClasses() == null || teacher.getTeacherClasses().isEmpty()) {
            return "교사";
        }
        return teacher.getTeacherClasses().stream()
                .filter(TeacherClass::isPrimary)
                .map(tc -> tc.getClassGroup().getAgeGroup())
                .findFirst()
                .orElseGet(() -> teacher.getTeacherClasses().get(0).getClassGroup().getAgeGroup());
    }

    public List<TtsQuestion> getActiveQuestions() {
        return getActiveQuestions(today());
    }

    public List<TtsQuestion> getActiveQuestions(LocalDate date) {
        return questionPolicy.load().at(weekSunday(date));
    }

    @Transactional(readOnly = true)
    public TtsResponse getMyTtsRecord(User teacher, Integer year, Integer week) {
        if (year == null || week == null) throw AppException.badRequest("주차가 올바르지 않습니다.");
        return getWeek(teacher, TtsPeriod.sunday(year, week));
    }

    // ── 새 방식: 주 단위 조회 + 항목별 즉시 저장 ──

    @Transactional(readOnly = true)
    public TtsResponse getWeek(User teacher, LocalDate date) {
        LocalDate sunday = weekSunday(date);
        TtsRecord record = recordRepository
                .findByTeacherIdAndInfoYearAndWeekNum(teacher.getId(), weekYear(sunday), weekNum(sunday))
                .orElse(null);
        return buildWeekResponse(teacher.getId(), sunday, record);
    }

    @Transactional
    public TtsResponse saveAnswer(User teacher, TtsAnswerRequest request) {
        if (request.weekStart() == null || request.questionId() == null || request.answerData() == null) {
            throw AppException.badRequest("필수 값이 비어 있습니다.");
        }
        LocalDate today = today();
        LocalDate sunday = weekSunday(request.weekStart());
        if (sunday.isAfter(today)) {
            throw AppException.forbidden("다음 주 이후는 아직 체크할 수 없습니다.");
        }
        if (!TtsPeriod.includes(weekYear(sunday),weekNum(sunday))) {
            throw AppException.badRequest("TTS 입력은 2026년 4분기부터 관리합니다.");
        }
        if (TtsPeriod.closed(TtsPeriod.attendanceDate(sunday), today)) {
            throw AppException.forbidden("마감된 분기의 TTS는 조회만 할 수 있습니다.");
        }

        // A user lock also protects simultaneous first writes from multiple devices.
        userRepository.lockById(teacher.getId()).orElseThrow(() -> AppException.unauthorized("교사를 찾을 수 없습니다."));
        today = today(); // A blocked write may acquire the lock after Korean midnight.
        if (TtsPeriod.closed(TtsPeriod.attendanceDate(sunday), today)) {
            throw AppException.forbidden("마감된 분기의 TTS는 조회만 할 수 있습니다.");
        }
        if (isImportedPeriod(sunday)) {
            throw AppException.badRequest("시트에서 가져온 확정 점수입니다. 관리자에게 원본 점수 수정을 요청해 주세요.");
        }
        TtsQuestion question = getActiveQuestions(sunday).stream().filter(q -> q.getId().equals(request.questionId())).findFirst()
                .orElseThrow(() -> AppException.notFound("항목을 찾을 수 없습니다."));
        if (!question.isActive()) {
            throw AppException.badRequest("사용하지 않는 항목입니다.");
        }
        if (isLinked(question)) {
            throw AppException.badRequest("이 항목은 다른 화면 기록으로 자동 체크됩니다.");
        }

        int year = weekYear(sunday);
        int week = weekNum(sunday);
        TtsRecord record = recordRepository.findByTeacherIdAndInfoYearAndWeekNum(teacher.getId(), year, week)
                .orElseGet(() -> TtsRecord.builder()
                        .teacher(teacher)
                        .infoYear(year)
                        .weekNum(week)
                        .build());

        TtsAnswer existing = record.getAnswers().stream()
                .filter(a -> a.getQuestion().getId().equals(question.getId()))
                .findFirst()
                .orElse(null);
        String answerData = normalizeAnswer(question, request.answerData(), sunday, today,
                existing == null ? null : existing.getAnswerData());
        if (existing != null) {
            existing.setAnswerData(answerData);
        } else {
            record.addAnswer(TtsAnswer.builder().record(record).question(questionRepository.getReferenceById(question.getId())).answerData(answerData).build());
        }

        // 하나라도 체크돼 있으면 '참여한 주'로 본다
        record.setSubmitted(recordScore(record) > 0);
        TtsRecord saved = recordRepository.save(record);
        return buildWeekResponse(teacher.getId(), sunday, saved);
    }

    // 답변 값 검사: 미래 요일 체크 금지, 형식 통일
    private String normalizeAnswer(TtsQuestion question, String raw, LocalDate sunday, LocalDate today, String previous) {
        if (question.getType() == TtsQuestionType.ATTEND) {
            if (!"true".equals(raw) && !"false".equals(raw)) {
                throw AppException.badRequest("잘못된 값입니다.");
            }
            if (!TtsPeriod.editableAttendance(sunday, today)) {
                throw AppException.forbidden("주간 항목은 그 주 토요일이 속한 분기에만 수정할 수 있습니다.");
            }
            return raw;
        }
        Map<String, Boolean> dayMap;
        try {
            dayMap = objectMapper.readValue(raw, new TypeReference<>() {});
        } catch (Exception e) {
            throw AppException.badRequest("잘못된 값입니다.");
        }
        Map<String, Boolean> normalized = new LinkedHashMap<>();
        if (dayMap == null || !DAY_LABELS.containsAll(dayMap.keySet())) throw AppException.badRequest("요일 값이 올바르지 않습니다.");
        Map<String, Boolean> oldDays = readDays(previous);
        for (int i = 0; i < DAY_LABELS.size(); i++) {
            String label = DAY_LABELS.get(i);
            LocalDate date = sunday.plusDays(i + 1);
            if (TtsPeriod.closed(date, today)
                    && Boolean.TRUE.equals(oldDays.get(label)) != Boolean.TRUE.equals(dayMap.get(label))) {
                throw AppException.forbidden("마감된 분기의 체크는 변경할 수 없습니다. 현재 분기 날짜만 수정해 주세요.");
            }
            if (Boolean.TRUE.equals(dayMap.get(label))) {
                if (date.isAfter(today)) {
                    throw AppException.forbidden("아직 오지 않은 요일은 체크할 수 없습니다.");
                }
                normalized.put(label, true);
            }
        }
        try {
            return objectMapper.writeValueAsString(normalized);
        } catch (Exception e) {
            throw AppException.badRequest("잘못된 값입니다.");
        }
    }

    private Map<String, Boolean> readDays(String raw) {
        if (raw == null) return Map.of();
        try {
            Map<String, Boolean> values = objectMapper.readValue(raw, new TypeReference<>() {});
            return values == null ? Map.of() : values;
        } catch (Exception ignored) { return Map.of(); }
    }

    private TtsResponse buildWeekResponse(Long teacherId, LocalDate sunday, TtsRecord record) {
        LocalDate today = today();
        boolean importedPeriod = isImportedPeriod(sunday);
        Integer importedScore = sheetScoreFor(teacherId, sunday);
        var timeline = questionPolicy.load();
        Set<TtsLinkType> linkedDone = loadLinked(sunday, sunday.plusDays(6))
                .getOrDefault(teacherId, Map.of())
                .getOrDefault(sunday, Set.of());

        List<TtsResponse.LinkedResponse> linked = timeline.at(sunday).stream().filter(TtsService::isLinked)
                .map(q -> TtsResponse.LinkedResponse.builder()
                        .questionId(q.getId())
                        .checked(linkedDone.contains(q.getLinkType()))
                        .build())
                .toList();

        List<TtsResponse.AnswerResponse> answers = record == null ? List.of() : record.getAnswers().stream()
                .map(this::toAnswerResponse)
                .toList();

        return TtsResponse.builder()
                .id(record != null ? record.getId() : null)
                .year(weekYear(sunday))
                .weekNum(weekNum(sunday))
                .weekStart(sunday)
                .isSubmitted(importedPeriod ? importedScore != null && importedScore > 0 : record != null && record.isSubmitted())
                .answers(answers)
                .linked(linked)
                .score(importedPeriod ? (importedScore == null ? 0 : importedScore) : recordScore(record, timeline) + linkedScore(linkedDone, sunday, timeline))
                .importedScore(importedScore)
                .importedPeriod(importedPeriod)
                .serverToday(today)
                .editableDays(importedPeriod || !TtsPeriod.includes(weekYear(sunday), weekNum(sunday)) ? List.of()
                        : java.util.stream.IntStream.range(0, DAY_LABELS.size())
                        .filter(i -> TtsPeriod.editableDay(sunday.plusDays(i + 1), today))
                        .mapToObj(DAY_LABELS::get).toList())
                .attendanceDate(TtsPeriod.attendanceDate(sunday))
                .attendanceEditable(!importedPeriod && TtsPeriod.includes(weekYear(sunday), weekNum(sunday))
                        && TtsPeriod.editableAttendance(sunday, today))
                .closedQuarter(TtsPeriod.closed(TtsPeriod.attendanceDate(sunday), today))
                .build();
    }

    private Integer sheetScoreFor(Long teacherId, LocalDate sunday) {
        int year = weekYear(sunday), week = weekNum(sunday);
        if (!TtsPeriod.usesSheet(year, week)) return null;
        var allUsers = userRepository.findAll();
        var user = allUsers.stream().filter(u -> u.getId().equals(teacherId)).findFirst().orElse(null);
        if (user == null) return null;
        String name = user.getName().trim();
        if (allUsers.stream().filter(u -> u.getName().trim().equals(name)).count() != 1) return null;
        return legacyScoreRepository.findAllByInfoYear(year).stream()
                .filter(s -> s.getWeekNum() == week && s.getName().trim().equals(name))
                .map(TtsLegacyScore::getScore).findFirst().orElse(null);
    }

    private boolean isImportedPeriod(LocalDate sunday) {
        return TtsPeriod.usesSheet(weekYear(sunday),weekNum(sunday)) && legacyScoreRepository.findAllByInfoYear(weekYear(sunday))
                .stream().anyMatch(s -> s.getWeekNum()==weekNum(sunday));
    }

    public TtsResponse submitTts(User teacher, TtsSubmitRequest request) {
        throw AppException.badRequest("기존 일괄 제출 기능은 종료되었습니다. 화면을 새로고침한 뒤 항목별로 저장해주세요.");
    }

    // ── 점수 집계 (앱 기록 + 자동 연동 + 시트 가져오기) ──

    private List<User> activeTeachers() {
        return userRepository.findAllActiveWithClasses().stream()
                .filter(User::participatesInTeacherActivities)
                .collect(Collectors.toList());
    }

    /** 교사별 → 주차별 앱 점수 (직접 체크 + 자동 연동) */
    Map<Long, Map<Integer, Integer>> computeAppScores(int year, Map<Long, User> usersOut) {
        return computeAppScores(year, usersOut, null);
    }

    private Map<Long, Map<Integer, Integer>> computeAppScores(int year, Map<Long, User> usersOut,
            Map<Long, Map<Integer, Map<LocalDate, Integer>>> calendar) {
        Map<Long, Map<Integer, Integer>> scores = new HashMap<>();
        var timeline = questionPolicy.load();
        if (year < TtsPeriod.START_YEAR) return scores;
        int firstWeek = TtsPeriod.firstManagedWeek(year), lastWeek = TtsPeriod.weeksInYear(year);
        // Rules are resolved once per week within this request. A later request sees edits immediately.
        Map<Integer, Map<Long, TtsQuestion>> rulesByWeek = new HashMap<>();
        for (int week = firstWeek; week <= lastWeek; week++) {
            rulesByWeek.put(week, timeline.allAt(firstSunday(year).plusWeeks(week - 1L)).stream()
                    .collect(Collectors.toMap(TtsQuestion::getId, q -> q)));
        }
        Long previousRecord = null;
        Set<Long> seenQuestions = new HashSet<>();
        for (var row : recordRepository.findScoreRows(year, firstWeek, lastWeek)) {
            if (!Objects.equals(previousRecord, row.recordId())) {
                previousRecord = row.recordId();
                seenQuestions.clear();
            }
            var weekly = scores.computeIfAbsent(row.teacherId(), k -> new HashMap<>());
            // Keep an existing empty/unchecked record distinct from a missing record.
            weekly.putIfAbsent(row.weekNum(), 0);
            if (seenQuestions.add(row.questionId())) {
                var question = rulesByWeek.get(row.weekNum()).get(row.questionId());
                if (row.questionId() != null) weekly.merge(row.weekNum(), answerScore(row.answerData(), question), Integer::sum);
                if (calendar != null) projectCalendarAnswer(calendar, row, TtsPeriod.sunday(year, row.weekNum()), question, year);
            }
        }

        boolean hasLinkedRules = rulesByWeek.values().stream().flatMap(r -> r.values().stream())
                .anyMatch(q -> q.isActive() && isLinked(q));
        if (hasLinkedRules) {
            LocalDate from = firstSunday(year).plusWeeks(firstWeek - 1L);
            LocalDate to = firstSunday(year).plusWeeks(lastWeek).minusDays(1);
            loadLinked(from, to).forEach((teacherId, byWeek) -> byWeek.forEach((sunday, types) -> {
                if (weekYear(sunday) != year) return;
                var rules = rulesByWeek.get(weekNum(sunday));
                if (rules == null) return;
                int s = rules.values().stream().filter(q -> q.isActive() && isLinked(q))
                        .filter(q -> types.contains(q.getLinkType())).mapToInt(TtsService::pointsOf).sum();
                if (s > 0) {
                    scores.computeIfAbsent(teacherId, k -> new HashMap<>()).merge(weekNum(sunday), s, Integer::sum);
                    if (calendar != null) calendarScore(calendar, teacherId, sunday, TtsPeriod.attendanceDate(sunday), year, s);
                }
            }));
        }
        LocalDate nextSunday = weekSunday(LocalDate.of(year + 1, 1, 1));
        if (calendar != null && nextSunday.getYear() == year) {
            // Only the last partial week lives under next year's stored week key.
            var rules = timeline.allAt(nextSunday).stream().collect(Collectors.toMap(TtsQuestion::getId, q -> q));
            Set<String> seen = new HashSet<>();
            for (var row : recordRepository.findScoreRows(year + 1, 1, 1)) {
                if (seen.add(row.recordId() + ":" + row.questionId()))
                    projectCalendarAnswer(calendar, row, nextSunday, rules.get(row.questionId()), year);
            }
        }
        var missingUsers = new HashSet<>(scores.keySet());
        if (calendar != null) missingUsers.addAll(calendar.keySet());
        missingUsers.removeAll(usersOut.keySet());
        if (!missingUsers.isEmpty()) userRepository.findAllWithClassesByIdIn(missingUsers)
                .forEach(u -> usersOut.put(u.getId(), u));
        return scores;
    }

    /**
     * 모든 교사가 보는 TTS 통계용 데이터.
     * 주차별 점수만 내려주고, 순위·평균 같은 계산은 화면에서 한다.
     * 2026년 40·41주는 가져온 시트 점수를 우선하고 42주부터는 앱 점수를 쓴다.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getStats(int year) {
        TtsPeriod.firstSunday(year);
        LocalDate thisSunday = weekSunday(today());
        Map<String, Object> result = new HashMap<>();
        result.put("year", year);
        result.put("firstWeek", TtsPeriod.firstManagedWeek(year));
        result.put("lastWeek", TtsPeriod.weeksInYear(year));
        result.put("currentWeek", weekYear(thisSunday) == year ? weekNum(thisSunday) : null);
        result.put("serverToday", today());
        result.put("people", year < TtsPeriod.START_YEAR ? List.of() : calendarPeople(year));
        return result;
    }

    @Transactional(readOnly = true)
    public TtsWeekStatsResponse getWeekStats(int year, int week) {
        LocalDate sunday = TtsPeriod.sunday(year, week);
        if (!TtsPeriod.includes(year, week) || sunday.isAfter(weekSunday(today()))) {
            throw AppException.badRequest("관리 중인 지난 주 또는 이번 주를 선택해 주세요.");
        }
        boolean imported = isImportedPeriod(sunday);
        var timeline = questionPolicy.load();
        var rules = timeline.allAt(sunday);
        int max = timeline.at(sunday).stream().mapToInt(q -> pointsOf(q)
                * (q.getType() == TtsQuestionType.DAYS && !isLinked(q) ? DAY_LABELS.size() : 1)).sum();
        var records = recordRepository.findAllByWeekWithAnswers(year, week).stream()
                .collect(Collectors.toMap(r -> r.getTeacher().getId(), r -> r));
        var linked = loadLinked(sunday, sunday.plusDays(6));
        var people = scorePeople(year).stream()
                .filter(p -> p.get("teacherId") != null || weekly(p).containsKey(week))
                .map(p -> {
                    Long id = (Long) p.get("teacherId");
                    var record = records.get(id);
                    var done = linked.getOrDefault(id, Map.of()).getOrDefault(sunday, Set.of());
                    Map<Long, TtsAnswer> answers = record == null ? Map.of() : record.getAnswers().stream()
                            .collect(Collectors.toMap(a -> a.getQuestion().getId(), a -> a, (first, ignored) -> first));
                    List<TtsWeekStatsResponse.Item> items = imported ? List.of() : rules.stream()
                            .filter(q -> q.isActive() || (!isLinked(q) && answers.containsKey(q.getId())))
                            .map(q -> detailItem(q, answers.get(q.getId()), done)).toList();
                    return new TtsWeekStatsResponse.Person((String) p.get("key"), id, (String) p.get("name"),
                            (String) p.get("grade"), weekly(p).get(week), imported ? "SHEET" : "APP",
                            !imported && record != null ? record.getUpdatedAt() : null, items);
                }).toList();
        return new TtsWeekStatsResponse(year, week, sunday, imported ? null : max, imported, people);
    }

    private TtsWeekStatsResponse.Item detailItem(TtsQuestion q, TtsAnswer answer, Set<TtsLinkType> linked) {
        List<String> days = List.of();
        boolean checked = isLinked(q) ? q.isActive() && linked.contains(q.getLinkType())
                : answer != null && "true".equals(answer.getAnswerData());
        if (!isLinked(q) && q.getType() == TtsQuestionType.DAYS && answer != null) {
            try {
                Map<String, Boolean> values = objectMapper.readValue(answer.getAnswerData(), new TypeReference<>() {});
                if (values != null) days = DAY_LABELS.stream().filter(d -> Boolean.TRUE.equals(values.get(d))).toList();
            } catch (Exception ignored) { /* Same invalid-value policy as answerScore. */ }
        }
        int score = isLinked(q) ? (checked ? pointsOf(q) : 0) : answer == null ? 0 : answerScore(answer, q);
        return new TtsWeekStatsResponse.Item(q.getId(), q.getTitle(), q.getType().name(), pointsOf(q),
                isLinked(q), q.isActive(), days, checked, score,
                q.getType() == TtsQuestionType.DAYS && !isLinked(q) ? DAY_LABELS : List.of());
    }

    @Transactional(readOnly = true)
    public TtsWeekStatsResponse getWeekStats(int year, int week, int calendarYear, int quarter) {
        LocalDate start = TtsPeriod.quarterStart(calendarYear, quarter);
        LocalDate end = TtsPeriod.quarterEnd(calendarYear, quarter);
        var full = getWeekStats(year, week);
        LocalDate sunday = full.weekStart();
        if (sunday.isAfter(end) || sunday.plusDays(6).isBefore(start)) {
            throw AppException.badRequest("선택한 분기에 속하는 주가 아닙니다.");
        }
        if (full.importedPeriod()) {
            if (calendarYear != 2026 || quarter != 4) throw AppException.badRequest("시트 확정 점수는 2026년 4분기에 포함됩니다.");
            return full;
        }
        var people = full.people().stream().map(person -> {
            List<TtsWeekStatsResponse.Item> items = person.items().stream().map(item -> {
                if (item.type().equals("DAYS") && !item.linked()) {
                    var days = item.days().stream().filter(day -> inRange(sunday.plusDays(DAY_LABELS.indexOf(day) + 1), start, end)).toList();
                    var eligible = DAY_LABELS.stream().filter(day -> inRange(sunday.plusDays(DAY_LABELS.indexOf(day) + 1), start, end)).toList();
                    return new TtsWeekStatsResponse.Item(item.questionId(), item.title(), item.type(), item.points(),
                            false, item.active(), days, false, days.size() * item.points(), eligible);
                }
                return inRange(TtsPeriod.attendanceDate(sunday), start, end) ? item : null;
            }).filter(Objects::nonNull).toList();
            Integer score = person.score() == null ? null : items.stream().mapToInt(TtsWeekStatsResponse.Item::score).sum();
            return new TtsWeekStatsResponse.Person(person.key(), person.teacherId(), person.name(), person.grade(),
                    score, person.source(), person.updatedAt(), items);
        }).toList();
        int days = (int) java.util.stream.IntStream.range(0, DAY_LABELS.size())
                .filter(i -> inRange(sunday.plusDays(i + 1), start, end)).count();
        int max = questionPolicy.load().at(sunday).stream().mapToInt(q -> q.getType() == TtsQuestionType.DAYS && !isLinked(q)
                ? pointsOf(q) * days : inRange(TtsPeriod.attendanceDate(sunday), start, end) ? pointsOf(q) : 0).sum();
        return new TtsWeekStatsResponse(year, week, sunday, max, false, people);
    }

    private static boolean inRange(LocalDate date, LocalDate start, LocalDate end) {
        return !date.isBefore(start) && !date.isAfter(end);
    }

    private List<Map<String, Object>> scorePeople(int year) {
        return scorePeople(year, null);
    }

    private List<Map<String, Object>> scorePeople(int year, Map<Long, Map<Integer, Map<LocalDate, Integer>>> calendar) {
        Map<Long, User> users = new LinkedHashMap<>();
        activeTeachers().forEach(t -> users.put(t.getId(), t));
        Map<Long, Map<Integer, Integer>> appScores = computeAppScores(year, users, calendar);
        var imported = legacyScoreRepository.findAllByInfoYear(year).stream()
                .filter(s -> TtsPeriod.usesSheet(year,s.getWeekNum())).toList();
        var importedWeeks = imported.stream().map(TtsLegacyScore::getWeekNum).collect(Collectors.toSet());
        // Once a whole week is imported, a blank cell stays unrecorded instead of reviving an old app score.
        appScores.values().forEach(scores -> scores.keySet().removeAll(importedWeeks));
        if (calendar != null && !importedWeeks.isEmpty()) calendar.values().forEach(quarters -> quarters.values()
                .forEach(weeks -> weeks.keySet().removeIf(day -> weekYear(day) == year && importedWeeks.contains(weekNum(day)))));
        appScores.keySet().forEach(id -> users.computeIfAbsent(id, k -> userRepository.findById(k).orElse(null)));
        users.values().removeIf(Objects::isNull);

        // 이름이 정확히 한 명과 일치할 때만 시트 점수를 그 교사에게 붙인다
        // 활동 상태나 현재 역할이 다른 동명이인도 포함해 잘못된 계정 연결을 막는다.
        Map<String, List<User>> byName = imported.isEmpty() ? Map.of() : userRepository.findAll().stream()
                .collect(Collectors.groupingBy(u -> u.getName().trim()));

        Map<String, Map<String, Object>> people = new LinkedHashMap<>();
        for (User u : users.values()) {
            Map<String, Object> p = scorePerson("u" + u.getId(), u.getName(), u);
            p.put("weekly", new TreeMap<>(appScores.getOrDefault(u.getId(), Map.of())));
            people.put("u" + u.getId(), p);
        }

        for (TtsLegacyScore ls : imported) {
            String name = ls.getName().trim();
            List<User> matched = byName.getOrDefault(name, List.of());
            String key = matched.size() == 1 ? "u" + matched.get(0).getId() : "n:" + name;
            Map<String, Object> p = people.computeIfAbsent(key,
                    k -> scorePerson(k, name, matched.size() == 1 ? matched.get(0) : null));
            @SuppressWarnings("unchecked")
            Map<Integer, Integer> weekly = (Map<Integer, Integer>) p.get("weekly");
            weekly.put(ls.getWeekNum(), ls.getScore());
            @SuppressWarnings("unchecked")
            Set<Integer> sheetWeeks = (Set<Integer>) p.get("sheetWeeks");
            sheetWeeks.add(ls.getWeekNum());
        }
        return new ArrayList<>(people.values());
    }

    /** Calendar statistics are an extra projection; the existing week-year keys and answers stay intact. */
    private List<Map<String, Object>> calendarPeople(int year) {
        Map<Long, Map<Integer, Map<LocalDate, Integer>>> scores = new HashMap<>();
        List<Map<String, Object>> people = scorePeople(year, scores);

        for (var person : people) {
            Map<Integer, Map<LocalDate, Integer>> byQuarter = scores.getOrDefault((Long) person.get("teacherId"), Map.of());
            Map<Integer, Map<String, Object>> quarters = new LinkedHashMap<>();
            for (int q = 1; q <= 4; q++) {
                Map<String, Integer> weekly = new TreeMap<>();
                byQuarter.getOrDefault(q, Map.of()).forEach((week, score) -> weekly.put(week.toString(), score));
                // 2026 sheet totals have no day-level data. Preserve their approved Q4 attribution verbatim.
                if (year == TtsPeriod.START_YEAR && q == 4) {
                    for (var week : (Set<?>) person.get("sheetWeeks")) {
                        int w = (Integer) week;
                        weekly.put(TtsPeriod.sunday(year, w).toString(), weekly(person).get(w));
                    }
                }
                Map<String, Object> value = new LinkedHashMap<>();
                value.put("weekly", weekly);
                value.put("total", weekly.values().stream().mapToInt(Integer::intValue).sum());
                value.put("weeks", weekly.values().stream().filter(s -> s > 0).count());
                quarters.put(q, value);
            }
            person.put("calendarQuarters", quarters);
        }
        return people;
    }

    private void projectCalendarAnswer(Map<Long, Map<Integer, Map<LocalDate, Integer>>> scores,
            com.newaveflow.dto.tts.TtsScoreRow row, LocalDate sunday, TtsQuestion q, int year) {
        if (q != null && q.getType() == TtsQuestionType.DAYS && !isLinked(q)) {
            var days = readDays(row.answerData());
            for (int i = 0; i < DAY_LABELS.size(); i++) calendarScore(scores, row.teacherId(), sunday, sunday.plusDays(i + 1), year,
                    Boolean.TRUE.equals(days.get(DAY_LABELS.get(i))) ? pointsOf(q) : 0);
        } else calendarScore(scores, row.teacherId(), sunday, TtsPeriod.attendanceDate(sunday), year,
                q == null || isLinked(q) ? 0 : answerScore(row.answerData(), q));
    }

    private void calendarScore(Map<Long, Map<Integer, Map<LocalDate, Integer>>> scores, Long teacher,
                               LocalDate sunday, LocalDate date, int year, int value) {
        if (date.getYear() != year || (year == TtsPeriod.START_YEAR && TtsPeriod.quarter(date) < 4)) return;
        scores.computeIfAbsent(teacher, k -> new HashMap<>()).computeIfAbsent(TtsPeriod.quarter(date), k -> new TreeMap<>())
                .merge(sunday, value, Integer::sum);
    }

    private Map<String, Object> scorePerson(String key, String name, User user) {
        Map<String, Object> person = new HashMap<>();
        person.put("key", key);
        person.put("teacherId", user == null ? null : user.getId());
        person.put("name", name);
        person.put("grade", user == null ? "시트 기록" : resolveTeacherGrade(user));
        person.put("weekly", new TreeMap<Integer, Integer>());
        person.put("sheetWeeks", new TreeSet<Integer>());
        return person;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAdminSummary(Integer year, Integer weekNum) {
        if (year == null || weekNum == null) throw AppException.badRequest("주차가 올바르지 않습니다.");
        TtsPeriod.sunday(year, weekNum);
        if (!TtsPeriod.includes(year, weekNum)) return List.of();

        List<TtsRecord> records = recordRepository.findAllByWeekWithAnswers(year, weekNum);
        Map<Long, TtsRecord> recordMap = records.stream()
                .collect(Collectors.toMap(r -> r.getTeacher().getId(), r -> r));

        return scorePeople(year).stream().filter(p -> p.get("teacherId") != null || weekly(p).containsKey(weekNum)).map(p -> {
            TtsRecord record = recordMap.get(p.get("teacherId"));
            int score = weekly(p).getOrDefault(weekNum, 0);
            boolean fromSheet = ((Set<?>) p.get("sheetWeeks")).contains(weekNum);
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("key", p.get("key"));
            map.put("teacherId", p.get("teacherId"));
            map.put("teacherName", p.get("name"));
            map.put("grade", p.get("grade"));
            map.put("isSubmitted", score > 0);
            map.put("recordId", record != null ? record.getId() : -1L);
            map.put("score", score);
            map.put("updatedAt", record != null && !fromSheet ? record.getUpdatedAt() : null);
            map.put("scoreSource", fromSheet ? "SHEET" : "APP");
            return map;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getQuarterlyScores(Integer year, Integer quarter) {
        if (year == null || quarter == null) throw AppException.badRequest("연도와 분기를 선택해 주세요.");
        TtsPeriod.validateQuarter(year, quarter);
        if (year < TtsPeriod.START_YEAR || (year == TtsPeriod.START_YEAR && quarter < 4)) return List.of();

        return calendarPeople(year).stream().map(person -> {
            @SuppressWarnings("unchecked")
            var quarters = (Map<Integer, Map<String, Object>>) person.get("calendarQuarters");
            @SuppressWarnings("unchecked")
            var calendarWeeks = (Map<String, Integer>) quarters.get(quarter).get("weekly");
            List<Map<String, Object>> weeklyScores = calendarWeeks.entrySet().stream()
                    .map(e -> {
                        LocalDate sunday = LocalDate.parse(e.getKey());
                        Map<String, Object> ws = new HashMap<>();
                        ws.put("weekNum", (int) ChronoUnit.WEEKS.between(firstSunday(year), sunday) + 1);
                        ws.put("weekStart", sunday);
                        ws.put("year", weekYear(sunday));
                        ws.put("recordWeekNum", weekNum(sunday));
                        ws.put("score", e.getValue());
                        return ws;
                    })
                    .collect(Collectors.toList());

            int totalScore = weeklyScores.stream().mapToInt(ws -> (Integer) ws.get("score")).sum();

            Map<String, Object> result = new HashMap<>();
            result.put("key", person.get("key"));
            result.put("teacherId", person.get("teacherId"));
            result.put("teacherName", person.get("name"));
            result.put("grade", person.get("grade"));
            result.put("totalScore", totalScore);
            result.put("weekCount", weeklyScores.stream().filter(ws -> (Integer) ws.get("score") > 0).count());
            result.put("weeklyScores", weeklyScores);
            return result;
        }).collect(Collectors.toList());
    }

    @SuppressWarnings("unchecked")
    private Map<Integer, Integer> weekly(Map<String, Object> person) {
        return (Map<Integer, Integer>) person.get("weekly");
    }

    public List<TtsQuestion> getAllQuestions() {
        return questionRepository.findAllByOrderByDisplayOrderAsc();
    }

    @Transactional
    public List<TtsQuestion> updateQuestions(List<TtsQuestion> newQuestions) {
        return questionPolicy.update(newQuestions);
    }

    public boolean isSubmissionWindowOpen() { return true; }

    private TtsRecord createEmptyRecord(User teacher, Integer year, Integer weekNum) {
        TtsRecord record = TtsRecord.builder()
                .teacher(teacher)
                .infoYear(year)
                .weekNum(weekNum)
                .isSubmitted(false)
                .build();
        return recordRepository.save(record);
    }

    private TtsResponse.AnswerResponse toAnswerResponse(TtsAnswer a) {
        return TtsResponse.AnswerResponse.builder()
                .questionId(a.getQuestion().getId())
                .title(a.getQuestion().getTitle())
                .type(a.getQuestion().getType())
                .emoji(a.getQuestion().getEmoji())
                .answerData(a.getAnswerData())
                .build();
    }

    private TtsResponse convertToResponse(TtsRecord record) {
        return TtsResponse.builder()
                .id(record.getId())
                .year(record.getInfoYear())
                .weekNum(record.getWeekNum())
                .isSubmitted(record.isSubmitted())
                .answers(record.getAnswers().stream().map(this::toAnswerResponse).collect(Collectors.toList()))
                .score(recordScore(record))
                .build();
    }

    // ── 점수 규칙 ──

    static int pointsOf(TtsQuestion q) {
        if (q.getPoints() != null) return q.getPoints();
        return q.getType() == TtsQuestionType.DAYS ? 5 : 10;
    }

    static boolean isLinked(TtsQuestion q) {
        return q.getLinkType() != null && q.getLinkType() != TtsLinkType.NONE;
    }

    private List<TtsQuestion> linkedQuestions() {
        return getActiveQuestions().stream().filter(TtsService::isLinked).toList();
    }

    private int answerScore(TtsAnswer answer, TtsQuestion question) {
        return answerScore(answer.getAnswerData(), question);
    }

    private int answerScore(String data, TtsQuestion question) {
        if (question == null || isLinked(question) || data == null || data.isBlank()) return 0;
        if (question.getType() == TtsQuestionType.DAYS) {
            try {
                Map<String, Boolean> days = objectMapper.readValue(data, new TypeReference<>() {});
                if (days == null) return 0;
                return (int) DAY_LABELS.stream().filter(day -> Boolean.TRUE.equals(days.get(day))).count() * pointsOf(question);
            } catch (Exception ignored) { return 0; }
        }
        return "true".equals(data) ? pointsOf(question) : 0;
    }

    int recordScore(TtsRecord record) { return recordScore(record, questionPolicy.load()); }

    private int recordScore(TtsRecord record, TtsQuestionPolicy.Timeline timeline) {
        if (record == null || record.getAnswers() == null) return 0;
        LocalDate sunday = firstSunday(record.getInfoYear()).plusWeeks(record.getWeekNum() - 1);
        var rules = timeline.allAt(sunday).stream().collect(Collectors.toMap(TtsQuestion::getId, q -> q));
        Set<Long> seen = new HashSet<>();
        return record.getAnswers().stream().filter(a -> seen.add(a.getQuestion().getId()))
                .mapToInt(a -> answerScore(a, rules.get(a.getQuestion().getId()))).sum();
    }

    private int linkedScore(Set<TtsLinkType> done, LocalDate sunday, TtsQuestionPolicy.Timeline timeline) {
        return timeline.at(sunday).stream().filter(TtsService::isLinked)
                .filter(q -> done.contains(q.getLinkType())).mapToInt(TtsService::pointsOf).sum();
    }

    /** 교사별 → 주(일요일)별로 자동 연동된 활동 (토요회의 참석, 기도모임 화/목 참석) */
    private Map<Long, Map<LocalDate, Set<TtsLinkType>>> loadLinked(LocalDate from, LocalDate to) {
        Map<Long, Map<LocalDate, Set<TtsLinkType>>> result = new HashMap<>();
        for (MeetingAttendance m : meetingAttendanceRepository.findByMeetingDateBetween(from, to)) {
            if (!"ATTEND".equals(m.getStatus())) continue;
            result.computeIfAbsent(m.getTeacher().getId(), k -> new HashMap<>())
                    .computeIfAbsent(weekSunday(m.getMeetingDate()), k -> EnumSet.noneOf(TtsLinkType.class))
                    .add(TtsLinkType.SAT_MEETING);
        }
        // 기도모임 주차는 월요일 시작이므로, 그 전날 일요일부터 조회한다
        for (PrayerVote v : prayerVoteRepository.findByWeekStartBetween(from.plusDays(1), to.plusDays(1))) {
            if (v.getStatus() == PrayerVote.Status.ABSENT) continue;
            result.computeIfAbsent(v.getTeacher().getId(), k -> new HashMap<>())
                    .computeIfAbsent(weekSunday(v.getWeekStart()), k -> EnumSet.noneOf(TtsLinkType.class))
                    .add(TtsLinkType.PRAYER_MEETING);
        }
        for (var snapshot : linkedSnapshotRepository.findByWeekStartBetween(from, to)) {
            var types = result.computeIfAbsent(snapshot.getTeacher().getId(), k -> new HashMap<>())
                    .computeIfAbsent(snapshot.getWeekStart(), k -> EnumSet.noneOf(TtsLinkType.class));
            if (snapshot.isChecked()) types.add(snapshot.getLinkType());
            else types.remove(snapshot.getLinkType());
        }
        return result;
    }

    /** Called in the same transaction before a source change; includes an absent/false result. */
    @Transactional
    public void preserveClosedLinkedScore(Long teacherId, LocalDate activityDate, TtsLinkType type) {
        LocalDate sunday = weekSunday(activityDate);
        if (!TtsPeriod.includes(weekYear(sunday), weekNum(sunday))) return;
        // All source mutations share this lock with TTS writes, so first snapshot and edit are atomic.
        User teacher = userRepository.lockById(teacherId).orElseThrow(() -> AppException.notFound("교사를 찾을 수 없습니다."));
        // A queued source edit may acquire its lock after the quarter closes at Korean midnight.
        if (!TtsPeriod.closed(TtsPeriod.attendanceDate(sunday), today())) return;
        if (questionPolicy.load().at(sunday).stream().noneMatch(q -> q.getLinkType() == type)) return;
        if (linkedSnapshotRepository.existsByTeacherIdAndWeekStartAndLinkType(teacherId, sunday, type)) return;
        boolean checked = loadLinked(sunday, sunday.plusDays(6)).getOrDefault(teacherId, Map.of())
                .getOrDefault(sunday, Set.of()).contains(type);
        linkedSnapshotRepository.save(TtsLinkedSnapshot.builder().teacher(teacher).weekStart(sunday)
                .linkType(type).checked(checked).build());
    }

}
