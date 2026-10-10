package com.newaveflow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.dto.tts.TtsAnswerRequest;
import com.newaveflow.dto.tts.TtsResponse;
import com.newaveflow.dto.tts.TtsSubmitRequest;
import com.newaveflow.entity.*;
import com.newaveflow.entity.TtsQuestion.TtsLinkType;
import com.newaveflow.entity.TtsQuestion.TtsQuestionType;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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

    // ── 주차 계산: 일~토 한 주, 1월 1일이 들어 있는 주가 1주차 (화면의 date-fns getWeek와 동일) ──

    public static LocalDate weekSunday(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
    }

    private static LocalDate firstSunday(int year) {
        return weekSunday(LocalDate.of(year, 1, 1));
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
        return getActiveQuestions(LocalDate.now());
    }

    public List<TtsQuestion> getActiveQuestions(LocalDate date) {
        return questionPolicy.load().at(weekSunday(date));
    }

    @Transactional(readOnly = true)
    public TtsResponse getMyTtsRecord(User teacher, Integer year, Integer week) {
        if (year == null || year < 1900 || year > 9998 || week == null || week < 1 || week > 53) throw AppException.badRequest("주차가 올바르지 않습니다.");
        return getWeek(teacher, firstSunday(year).plusWeeks(week - 1));
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
        LocalDate today = LocalDate.now();
        LocalDate sunday = weekSunday(request.weekStart());
        if (sunday.isAfter(today)) {
            throw AppException.forbidden("다음 주 이후는 아직 체크할 수 없습니다.");
        }

        // A user lock also protects simultaneous first writes from multiple devices.
        userRepository.lockById(teacher.getId()).orElseThrow(() -> AppException.unauthorized("교사를 찾을 수 없습니다."));
        TtsQuestion question = getActiveQuestions(sunday).stream().filter(q -> q.getId().equals(request.questionId())).findFirst()
                .orElseThrow(() -> AppException.notFound("항목을 찾을 수 없습니다."));
        if (!question.isActive()) {
            throw AppException.badRequest("사용하지 않는 항목입니다.");
        }
        if (isLinked(question)) {
            throw AppException.badRequest("이 항목은 다른 화면 기록으로 자동 체크됩니다.");
        }

        String answerData = normalizeAnswer(question, request.answerData(), sunday, today);

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
    private String normalizeAnswer(TtsQuestion question, String raw, LocalDate sunday, LocalDate today) {
        if (question.getType() == TtsQuestionType.ATTEND) {
            if (!"true".equals(raw) && !"false".equals(raw)) {
                throw AppException.badRequest("잘못된 값입니다.");
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
        for (int i = 0; i < DAY_LABELS.size(); i++) {
            String label = DAY_LABELS.get(i);
            if (Boolean.TRUE.equals(dayMap.get(label))) {
                if (sunday.plusDays(i + 1).isAfter(today)) {
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

    private TtsResponse buildWeekResponse(Long teacherId, LocalDate sunday, TtsRecord record) {
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
                .isSubmitted(record != null && record.isSubmitted())
                .answers(answers)
                .linked(linked)
                .score(recordScore(record, timeline) + linkedScore(linkedDone, sunday, timeline))
                .build();
    }

    public TtsResponse submitTts(User teacher, TtsSubmitRequest request) {
        throw AppException.badRequest("기존 일괄 제출 기능은 종료되었습니다. 화면을 새로고침한 뒤 항목별로 저장해주세요.");
    }

    // ── 점수 집계 (앱 기록 + 자동 연동 + 시트 가져오기) ──

    private List<User> activeTeachers() {
        return userRepository.findAllActiveWithClasses().stream()
                .filter(u -> u.getRole() == User.Role.TEACHER || u.getRole() == User.Role.EXECUTIVE)
                .collect(Collectors.toList());
    }

    /** 교사별 → 주차별 앱 점수 (직접 체크 + 자동 연동) */
    private Map<Long, Map<Integer, Integer>> computeAppScores(int year, Map<Long, User> usersOut) {
        Map<Long, Map<Integer, Integer>> scores = new HashMap<>();
        var timeline = questionPolicy.load();

        for (TtsRecord r : recordRepository.findAllByYearWithAnswers(year)) {
            int s = recordScore(r, timeline);
            if (s <= 0) continue;
            usersOut.putIfAbsent(r.getTeacher().getId(), r.getTeacher());
            scores.computeIfAbsent(r.getTeacher().getId(), k -> new HashMap<>()).merge(r.getWeekNum(), s, Integer::sum);
        }

        LocalDate from = firstSunday(year);
        LocalDate to = firstSunday(year + 1).minusDays(1);
        loadLinked(from, to).forEach((teacherId, byWeek) -> byWeek.forEach((sunday, types) -> {
            int s = linkedScore(types, sunday, timeline);
            if (s <= 0) return;
            scores.computeIfAbsent(teacherId, k -> new HashMap<>()).merge(weekNum(sunday), s, Integer::sum);
        }));
        return scores;
    }

    /**
     * 모든 교사가 보는 TTS 통계용 데이터.
     * 주차별 점수만 내려주고, 순위·평균 같은 계산은 화면에서 한다.
     * 같은 주에 앱 점수가 있으면 앱 점수를, 없으면 시트에서 가져온 점수를 쓴다.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getStats(int year) {
        Map<Long, User> users = new LinkedHashMap<>();
        activeTeachers().forEach(t -> users.put(t.getId(), t));
        Map<Long, Map<Integer, Integer>> appScores = computeAppScores(year, users);
        appScores.keySet().forEach(id -> users.computeIfAbsent(id, k -> userRepository.findById(k).orElse(null)));
        users.values().removeIf(Objects::isNull);

        // 이름이 정확히 한 명과 일치할 때만 시트 점수를 그 교사에게 붙인다
        Map<String, List<User>> byName = users.values().stream()
                .collect(Collectors.groupingBy(u -> u.getName().trim()));

        Map<String, Map<String, Object>> people = new LinkedHashMap<>();
        for (User u : users.values()) {
            Map<String, Object> p = new HashMap<>();
            p.put("key", "u" + u.getId());
            p.put("teacherId", u.getId());
            p.put("name", u.getName());
            p.put("grade", resolveTeacherGrade(u));
            p.put("weekly", new TreeMap<>(appScores.getOrDefault(u.getId(), Map.of())));
            people.put("u" + u.getId(), p);
        }

        for (TtsLegacyScore ls : legacyScoreRepository.findAllByInfoYear(year)) {
            String name = ls.getName().trim();
            List<User> matched = byName.getOrDefault(name, List.of());
            String key = matched.size() == 1 ? "u" + matched.get(0).getId() : "n:" + name;
            Map<String, Object> p = people.computeIfAbsent(key, k -> {
                Map<String, Object> np = new HashMap<>();
                np.put("key", k);
                np.put("teacherId", null);
                np.put("name", name);
                np.put("grade", "");
                np.put("weekly", new TreeMap<Integer, Integer>());
                return np;
            });
            @SuppressWarnings("unchecked")
            Map<Integer, Integer> weekly = (Map<Integer, Integer>) p.get("weekly");
            weekly.putIfAbsent(ls.getWeekNum(), ls.getScore());
        }

        LocalDate thisSunday = weekSunday(LocalDate.now());
        Map<String, Object> result = new HashMap<>();
        result.put("year", year);
        result.put("currentWeek", weekYear(thisSunday) == year ? weekNum(thisSunday) : null);
        result.put("people", new ArrayList<>(people.values()));
        return result;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAdminSummary(Integer year, Integer weekNum) {
        List<User> teachers = activeTeachers();
        Map<Long, Map<Integer, Integer>> appScores = computeAppScores(year, new HashMap<>());

        List<TtsRecord> records = recordRepository.findAllByWeekWithAnswers(year, weekNum);
        Map<Long, TtsRecord> recordMap = records.stream()
                .collect(Collectors.toMap(r -> r.getTeacher().getId(), r -> r));

        return teachers.stream().map(t -> {
            TtsRecord record = recordMap.get(t.getId());
            int score = appScores.getOrDefault(t.getId(), Map.of()).getOrDefault(weekNum, 0);
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("teacherId", t.getId());
            map.put("teacherName", t.getName());
            map.put("grade", resolveTeacherGrade(t));
            map.put("isSubmitted", score > 0);
            map.put("recordId", record != null ? record.getId() : -1L);
            map.put("score", score);
            map.put("updatedAt", record != null ? record.getUpdatedAt() : null);
            return map;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getQuarterlyScores(Integer year, Integer quarter) {
        List<User> teachers = activeTeachers();
        Map<Long, Map<Integer, Integer>> appScores = computeAppScores(year, new HashMap<>());

        return teachers.stream().map(teacher -> {
            List<Map<String, Object>> weeklyScores = appScores.getOrDefault(teacher.getId(), Map.of()).entrySet().stream()
                    .filter(e -> getQuarterFromWeek(e.getKey()) == quarter)
                    .sorted(Map.Entry.comparingByKey())
                    .map(e -> {
                        Map<String, Object> ws = new HashMap<>();
                        ws.put("weekNum", e.getKey());
                        ws.put("score", e.getValue());
                        return ws;
                    })
                    .collect(Collectors.toList());

            int totalScore = weeklyScores.stream().mapToInt(ws -> (Integer) ws.get("score")).sum();

            Map<String, Object> result = new HashMap<>();
            result.put("teacherId", teacher.getId());
            result.put("teacherName", teacher.getName());
            result.put("grade", resolveTeacherGrade(teacher));
            result.put("totalScore", totalScore);
            result.put("weekCount", weeklyScores.size());
            result.put("weeklyScores", weeklyScores);
            return result;
        }).collect(Collectors.toList());
    }

    // ── 구글 시트 '주차별점수' 가져오기 ──

    private static final Pattern WEEK_HEADER = Pattern.compile("(\\d+)\\s*주차");

    /**
     * 시트에서 복사한 표(탭 구분) 또는 CSV를 받아 해당 연도 데이터를 통째로 바꾼다.
     * 첫 줄: 이름, 1주차(...), 2주차(...), ..., 합계
     */
    @Transactional
    public Map<String, Object> importLegacyScores(int year, String text) {
        if (text == null || text.isBlank()) throw AppException.badRequest("붙여넣은 내용이 없습니다.");
        List<String> lines = text.lines().filter(l -> !l.isBlank()).toList();
        char delimiter = lines.get(0).contains("\t") ? '\t' : ',';
        List<String> header = splitLine(lines.get(0), delimiter);

        int nameCol = -1;
        Map<Integer, Integer> weekCols = new LinkedHashMap<>();
        for (int i = 0; i < header.size(); i++) {
            String h = header.get(i).trim();
            if (nameCol < 0 && h.contains("이름")) nameCol = i;
            Matcher m = WEEK_HEADER.matcher(h);
            if (m.find()) weekCols.put(i, Integer.parseInt(m.group(1)));
        }
        if (nameCol < 0 || weekCols.isEmpty()) {
            throw AppException.badRequest("첫 줄에 '이름'과 'N주차' 칸이 있어야 합니다.");
        }

        Map<String, TtsLegacyScore> rows = new LinkedHashMap<>();
        Set<String> names = new LinkedHashSet<>();
        for (String line : lines.subList(1, lines.size())) {
            List<String> cells = splitLine(line, delimiter);
            if (nameCol >= cells.size()) continue;
            String name = cells.get(nameCol).trim();
            if (name.isEmpty() || name.equals("합계") || name.equals("평균")) continue;
            for (Map.Entry<Integer, Integer> wc : weekCols.entrySet()) {
                if (wc.getKey() >= cells.size()) continue;
                Integer score = parseScore(cells.get(wc.getKey()));
                if (score == null || score <= 0) continue;
                names.add(name);
                rows.put(name + "|" + wc.getValue(), TtsLegacyScore.builder()
                        .name(name).infoYear(year).weekNum(wc.getValue()).score(score).build());
            }
        }

        legacyScoreRepository.deleteAllByYear(year);
        legacyScoreRepository.flush();
        legacyScoreRepository.saveAll(rows.values());

        Set<String> userNames = userRepository.findAll().stream()
                .map(u -> u.getName().trim()).collect(Collectors.toSet());
        List<String> unmatched = names.stream().filter(n -> !userNames.contains(n)).toList();

        Map<String, Object> result = new HashMap<>();
        result.put("year", year);
        result.put("rows", rows.size());
        result.put("names", names.size());
        result.put("weeks", new TreeSet<>(weekCols.values()));
        result.put("unmatchedNames", unmatched);
        return result;
    }

    private static Integer parseScore(String raw) {
        String s = raw.trim().replace(",", "");
        if (s.isEmpty()) return null;
        try {
            return (int) Math.round(Double.parseDouble(s));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    // 따옴표로 감싼 칸을 고려한 간단한 CSV/TSV 한 줄 분리
    private static List<String> splitLine(String line, char delimiter) {
        List<String> cells = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (quoted && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cur.append('"');
                    i++;
                } else {
                    quoted = !quoted;
                }
            } else if (c == delimiter && !quoted) {
                cells.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(c);
            }
        }
        cells.add(cur.toString());
        return cells;
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
        String data = answer.getAnswerData();
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
        return result;
    }

    // Q1: 1~13주, Q2: 14~26주, Q3: 27~39주, Q4: 40~53주
    private int getQuarterFromWeek(int weekNum) {
        if (weekNum <= 13) return 1;
        if (weekNum <= 26) return 2;
        if (weekNum <= 39) return 3;
        return 4;
    }
}
