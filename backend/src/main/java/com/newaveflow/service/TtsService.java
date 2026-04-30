package com.newaveflow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.dto.tts.TtsResponse;
import com.newaveflow.dto.tts.TtsSubmitRequest;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TtsService {

    private final TtsQuestionRepository questionRepository;
    private final TtsRecordRepository recordRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public List<TtsQuestion> getActiveQuestions() {
        return questionRepository.findAllByIsActiveOrderByDisplayOrderAsc(true);
    }

    @Transactional
    public TtsResponse getMyTtsRecord(User teacher, Integer year, Integer weekNum) {
        TtsRecord record = recordRepository.findByTeacherIdAndInfoYearAndWeekNum(teacher.getId(), year, weekNum)
                .orElseGet(() -> createEmptyRecord(teacher, year, weekNum));

        return convertToResponse(record);
    }

    @Transactional
    public TtsResponse submitTts(User teacher, TtsSubmitRequest request) {
        if (!isSubmissionWindowOpen()) {
            throw new RuntimeException("TTS 제출 기간이 아닙니다 (토요일 ~ 화요일만 가능)");
        }

        TtsRecord record = recordRepository.findByTeacherIdAndInfoYearAndWeekNum(teacher.getId(), request.getYear(), request.getWeekNum())
                .orElseGet(() -> TtsRecord.builder()
                        .teacher(teacher)
                        .infoYear(request.getYear())
                        .weekNum(request.getWeekNum())
                        .isSubmitted(false)
                        .build());

        if (record.getAnswers() == null) {
            record.setAnswers(new ArrayList<>());
        } else {
            record.getAnswers().clear();
        }

        if (request.getAnswers() != null) {
            for (TtsSubmitRequest.AnswerRequest answerReq : request.getAnswers()) {
                TtsQuestion question = questionRepository.findById(answerReq.getQuestionId())
                        .orElseThrow(() -> new RuntimeException("질문을 찾을 수 없습니다: " + answerReq.getQuestionId()));

                TtsAnswer answer = TtsAnswer.builder()
                        .record(record)
                        .question(question)
                        .answerData(answerReq.getAnswerData())
                        .build();
                record.addAnswer(answer);
            }
        }

        record.setSubmitted(true);
        TtsRecord saved = recordRepository.save(record);
        return convertToResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAdminSummary(Integer year, Integer weekNum) {
        List<User> teachers = userRepository.findByIsActiveTrue().stream()
                .filter(u -> u.getRole() == User.Role.TEACHER || u.getRole() == User.Role.EXECUTIVE)
                .collect(Collectors.toList());

        List<TtsRecord> records = recordRepository.findAllByWeekWithAnswers(year, weekNum);
        Map<Long, TtsRecord> recordMap = records.stream()
                .collect(Collectors.toMap(r -> r.getTeacher().getId(), r -> r));

        return teachers.stream().map(t -> {
            TtsRecord record = recordMap.get(t.getId());
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("teacherId", t.getId());
            map.put("teacherName", t.getName());
            map.put("grade", t.getGrade());
            map.put("isSubmitted", record != null && record.isSubmitted());
            map.put("recordId", record != null ? record.getId() : -1L);
            map.put("score", record != null && record.isSubmitted() ? calculateScore(record) : 0);
            return map;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getQuarterlyScores(Integer year, Integer quarter) {
        List<User> teachers = userRepository.findByIsActiveTrue().stream()
                .filter(u -> u.getRole() == User.Role.TEACHER || u.getRole() == User.Role.EXECUTIVE)
                .collect(Collectors.toList());

        List<TtsRecord> allRecords = recordRepository.findAllSubmittedByYearWithAnswers(year);

        return teachers.stream().map(teacher -> {
            List<TtsRecord> teacherRecords = allRecords.stream()
                    .filter(r -> r.getTeacher().getId().equals(teacher.getId()))
                    .filter(r -> getQuarterFromWeek(r.getWeekNum()) == quarter)
                    .sorted(Comparator.comparingInt(TtsRecord::getWeekNum))
                    .collect(Collectors.toList());

            int totalScore = teacherRecords.stream()
                    .mapToInt(this::calculateScore)
                    .sum();

            List<Map<String, Object>> weeklyScores = teacherRecords.stream()
                    .map(r -> {
                        Map<String, Object> ws = new HashMap<>();
                        ws.put("weekNum", r.getWeekNum());
                        ws.put("score", calculateScore(r));
                        return ws;
                    })
                    .collect(Collectors.toList());

            Map<String, Object> result = new HashMap<>();
            result.put("teacherId", teacher.getId());
            result.put("teacherName", teacher.getName());
            result.put("grade", teacher.getGrade());
            result.put("totalScore", totalScore);
            result.put("weekCount", teacherRecords.size());
            result.put("weeklyScores", weeklyScores);
            return result;
        }).collect(Collectors.toList());
    }

    @Transactional
    public List<TtsQuestion> updateQuestions(List<TtsQuestion> newQuestions) {
        return questionRepository.saveAll(newQuestions);
    }

    public boolean isSubmissionWindowOpen() {
        DayOfWeek day = LocalDate.now().getDayOfWeek();
        return day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY ||
               day == DayOfWeek.MONDAY || day == DayOfWeek.TUESDAY;
    }

    private TtsRecord createEmptyRecord(User teacher, Integer year, Integer weekNum) {
        TtsRecord record = TtsRecord.builder()
                .teacher(teacher)
                .infoYear(year)
                .weekNum(weekNum)
                .isSubmitted(false)
                .build();
        return recordRepository.save(record);
    }

    private TtsResponse convertToResponse(TtsRecord record) {
        List<TtsResponse.AnswerResponse> answerResponses = record.getAnswers().stream()
                .map(a -> TtsResponse.AnswerResponse.builder()
                        .questionId(a.getQuestion().getId())
                        .title(a.getQuestion().getTitle())
                        .type(a.getQuestion().getType())
                        .emoji(a.getQuestion().getEmoji())
                        .answerData(a.getAnswerData())
                        .build())
                .collect(Collectors.toList());

        return TtsResponse.builder()
                .id(record.getId())
                .year(record.getInfoYear())
                .weekNum(record.getWeekNum())
                .isSubmitted(record.isSubmitted())
                .answers(answerResponses)
                .score(calculateScore(record))
                .build();
    }

    int calculateScore(TtsRecord record) {
        if (!record.isSubmitted() || record.getAnswers() == null) return 0;
        int score = 0;
        for (TtsAnswer answer : record.getAnswers()) {
            TtsQuestion question = answer.getQuestion();
            String data = answer.getAnswerData();
            if (data == null || data.isBlank()) continue;

            if (question.getType() == TtsQuestion.TtsQuestionType.DAYS) {
                try {
                    Map<String, Boolean> dayMap = objectMapper.readValue(data, new TypeReference<>() {});
                    long checkedDays = dayMap.values().stream().filter(v -> v != null && v).count();
                    score += (int) checkedDays * 5;
                } catch (Exception ignored) {}
            } else if (question.getType() == TtsQuestion.TtsQuestionType.ATTEND) {
                if ("true".equals(data)) score += 10;
            }
        }
        return score;
    }

    // Q1: 1~13주, Q2: 14~26주, Q3: 27~39주, Q4: 40~53주
    private int getQuarterFromWeek(int weekNum) {
        if (weekNum <= 13) return 1;
        if (weekNum <= 26) return 2;
        if (weekNum <= 39) return 3;
        return 4;
    }
}
