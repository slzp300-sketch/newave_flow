package com.newaveflow;

import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(showSql = false) @ActiveProfiles("test")
@Import({TtsService.class, TtsQuestionPolicy.class, HistoryAndReportingTest.JsonConfig.class})
class TtsStatsProjectionTest {
    @Autowired TtsService tts;
    @Autowired UserRepository users;
    @Autowired TtsQuestionRepository questions;
    @Autowired TtsRecordRepository records;
    @Autowired EntityManager em;

    User teacher(String name, boolean active) {
        return users.save(User.builder().name(name).email(name + "@example.invalid")
                .password("synthetic").role(User.Role.TEACHER).isActive(active).build());
    }
    TtsRecord record(User teacher, TtsQuestion question, int week, String answer) {
        var record = TtsRecord.builder().teacher(teacher).infoYear(2027).weekNum(week).build();
        if (question != null) record.addAnswer(TtsAnswer.builder().question(question).answerData(answer).build());
        return records.save(record);
    }
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> people() { return (List<Map<String, Object>>) tts.getStats(2027).get("people"); }

    @Test void fullYearUsesScalarAnswersWithoutHydratingRecordsOrGrowingQueriesPerTeacher() {
        var daily = questions.save(TtsQuestion.builder().title("가상 말씀")
                .type(TtsQuestion.TtsQuestionType.DAYS).points(5).build());
        var missing = teacher("가상 미기록", true);
        var empty = teacher("가상 빈기록", false);
        record(empty, null, 1, null);
        for (int i = 0; i < 20; i++) {
            var user = teacher("가상 기록" + i, i % 2 == 0);
            for (int week = 1; week <= 52; week++) record(user, daily, week, "{\"월\":true,\"토\":true,\"기타\":true}");
        }
        em.flush(); em.clear();
        var statistics = em.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics();
        boolean wasEnabled = statistics.isStatisticsEnabled();
        statistics.setStatisticsEnabled(true); statistics.clear();
        List<Map<String, Object>> result;
        try {
            result = people();
            assertEquals(0, statistics.getEntityStatistics(TtsRecord.class.getName()).getLoadCount());
            assertEquals(0, statistics.getEntityStatistics(TtsAnswer.class.getName()).getLoadCount());
            assertTrue(statistics.getPrepareStatementCount() <= 7, "Queries should be batched, including inactive teachers");
        } finally { statistics.setStatisticsEnabled(wasEnabled); }
        assertEquals(22, result.size());
        for (var person : result) {
            var weekly = (Map<?, ?>) person.get("weekly");
            if (person.get("teacherId").equals(missing.getId())) assertTrue(weekly.isEmpty());
            else if (person.get("teacherId").equals(empty.getId())) assertEquals(Map.of(1, 0), weekly);
            else { assertEquals(52, weekly.size()); assertTrue(weekly.values().stream().allMatch(v -> v.equals(10))); }
        }
    }

    @Test void subsequentStatsReflectUncheckedAnswersAndDoNotCountDuplicateAnswersTwice() {
        var user = teacher("가상 수정", true);
        var question = questions.save(TtsQuestion.builder().title("가상 완료")
                .type(TtsQuestion.TtsQuestionType.ATTEND).points(10).build());
        var record = record(user, question, 1, "true");
        record.addAnswer(TtsAnswer.builder().question(question).answerData("true").build());
        records.saveAndFlush(record); em.clear();
        assertEquals(Map.of(1, 10), people().get(0).get("weekly"));
        var saved = records.findById(record.getId()).orElseThrow();
        saved.getAnswers().forEach(a -> a.setAnswerData("false"));
        em.flush(); em.clear();
        assertEquals(Map.of(1, 0), people().get(0).get("weekly"));
    }
}
