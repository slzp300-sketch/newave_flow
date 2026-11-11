package com.newaveflow;

import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(showSql = false) @ActiveProfiles("test")
@Import({TtsService.class, TtsQuestionPolicy.class, TtsLegacyImportService.class, HistoryAndReportingTest.JsonConfig.class})
class TtsQuarterlyTest {
    @Autowired TtsService tts;
    @Autowired TtsLegacyImportService importer;
    @Autowired UserRepository users;
    @Autowired TtsQuestionRepository questions;
    @Autowired TtsRecordRepository records;
    @Autowired TtsLegacyScoreRepository legacy;

    @BeforeEach void importDuringItsOriginalQuarter() {
        ReflectionTestUtils.setField(importer, "clock", Clock.fixed(Instant.parse("2026-10-20T03:00:00Z"), TtsPeriod.ZONE));
    }
    @AfterEach void restoreClock() { ReflectionTestUtils.setField(importer, "clock", Clock.system(TtsPeriod.ZONE)); }

    User teacher(String name, String email, boolean active) {
        return users.saveAndFlush(User.builder().name(name).email(email + "@example.invalid")
                .password("synthetic").role(User.Role.TEACHER).isActive(active).build());
    }
    void appScore(User user, int year, int week, int score) {
        var q = questions.saveAndFlush(TtsQuestion.builder().title("가상 배점 " + year + "-" + week)
                .type(TtsQuestion.TtsQuestionType.ATTEND).points(score).build());
        var record = TtsRecord.builder().teacher(user).infoYear(year).weekNum(week).build();
        record.addAnswer(TtsAnswer.builder().question(q).answerData("true").build());
        records.saveAndFlush(record);
    }
    void sheetScore(String name, int year, int week, int score) {
        legacy.saveAndFlush(TtsLegacyScore.builder().name(name).infoYear(year).weekNum(week).score(score).build());
    }
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> people(int year) { return (List<Map<String, Object>>) tts.getStats(year).get("people"); }
    @SuppressWarnings("unchecked")
    Map<Integer, Integer> weekly(Map<String, Object> person) { return (Map<Integer, Integer>) person.get("weekly"); }

    @Test void teacherAdminAndSummaryUseSameSheetOverrideWithoutAddingScoresTwice() {
        var user = teacher("가상 교사", "quarter", true);
        appScore(user, 2026, 41, 80); appScore(user, 2026, 42, 15);
        sheetScore(user.getName(), 2026, 40, 70); sheetScore(user.getName(), 2026, 41, 100);
        sheetScore("가상 미가입", 2026, 40, 150); sheetScore("가상 미가입", 2026, 41, 0);
        // 42주차부터는 앱이 기준이며, 혹시 남은 시트 값으로 대체하지 않는다.
        sheetScore(user.getName(), 2026, 42, 999);
        var stats = people(2026);
        var mine = stats.stream().filter(p -> Objects.equals(user.getId(), p.get("teacherId"))).findFirst().orElseThrow();
        assertEquals(Map.of(40,70,41,100,42,15), weekly(mine));
        var quarterly = tts.getQuarterlyScores(2026,4);
        for (var person : stats) {
            var admin = quarterly.stream().filter(p -> Objects.equals(person.get("key"),p.get("key"))).findFirst().orElseThrow();
            assertEquals(weekly(person).values().stream().mapToInt(Integer::intValue).sum(), admin.get("totalScore"));
        }
        var summary = tts.getAdminSummary(2026,41);
        assertEquals(100, summary.stream().filter(p -> Objects.equals(user.getId(),p.get("teacherId"))).findFirst().orElseThrow().get("score"));
        assertEquals(2, summary.size());
        assertEquals(100, tts.getWeek(user,LocalDate.of(2026,10,4)).getImportedScore());
        assertEquals(100, tts.getWeek(user,LocalDate.of(2026,10,4)).getScore());
        var answer = new com.newaveflow.dto.tts.TtsAnswerRequest(LocalDate.of(2026,10,4),questions.findAll().get(0).getId(),"false");
        assertThrows(AppException.class,()->tts.saveAnswer(user,answer));
        assertEquals(2, records.count()); assertEquals(5, legacy.count());
    }

    @Test void firstThreeQuartersStayStoredButDoNotEnterManagedTotals() {
        var user = teacher("가상 보존", "preserved", true);
        appScore(user,2026,13,100); appScore(user,2026,39,200); appScore(user,2026,40,10);
        sheetScore(user.getName(),2026,19,85);
        assertEquals(Map.of(40,10),weekly(people(2026).get(0)));
        assertTrue(tts.getQuarterlyScores(2026,3).isEmpty());
        assertTrue(tts.getAdminSummary(2026,39).isEmpty());
        assertEquals(3, records.count()); assertEquals(1, legacy.count());
    }

    @Test void duplicateNameIncludingInactiveAccountIsNotAttachedToWrongPerson() {
        teacher("가상 동명", "same1", true); teacher("가상 동명", "same2", false);
        sheetScore("가상 동명",2026,40,100);
        var imported = people(2026).stream().filter(p -> weekly(p).containsKey(40)).findFirst().orElseThrow();
        assertNull(imported.get("teacherId")); assertEquals("n:가상 동명",imported.get("key"));
        assertEquals(100,tts.getQuarterlyScores(2026,4).stream().mapToInt(p -> (Integer)p.get("totalScore")).sum());
    }

    @Test void newYearAndEachQuarterStartWithSeparateScores() {
        var user = teacher("가상 전환", "rollover", true);
        appScore(user,2026,52,90);
        for (int week : List.of(1,13,14,26,27,39,40,52)) appScore(user,2027,week,10);
        assertEquals(90,tts.getQuarterlyScores(2026,4).get(0).get("totalScore"));
        for (int q=1;q<=4;q++) assertEquals(20,tts.getQuarterlyScores(2027,q).get(0).get("totalScore"));
        assertEquals(LocalDate.of(2026,12,27),TtsPeriod.sunday(2027,1));
        assertEquals(52,TtsPeriod.weeksInYear(2026)); assertEquals(52,TtsPeriod.weeksInYear(2027));
        assertEquals(53,TtsPeriod.weeksInYear(2028));
    }

    @Test void invalidWeekAndQuarterCannotWrapIntoAnotherPeriod() {
        var user = teacher("가상 주차", "invalid", true);
        assertThrows(AppException.class,()->tts.getMyTtsRecord(user,2026,53));
        assertThrows(AppException.class,()->tts.getAdminSummary(2027,53));
        assertThrows(AppException.class,()->tts.getQuarterlyScores(2027,5));
        assertThrows(AppException.class,()->tts.getStats(10000));
        assertEquals(LocalDate.of(2028,12,24),TtsPeriod.sunday(2028,53));
        assertEquals(0, records.count());
    }

    com.newaveflow.dto.tts.TtsImportRequest request(String text, String token) {
        return new com.newaveflow.dto.tts.TtsImportRequest(2026,40,41,text,token);
    }

    @Test void importRequiresPreviewAndOnlyReplacesSelectedWeeks() {
        var user=teacher("가상 이관","import",true);
        appScore(user,2026,41,80);
        sheetScore(user.getName(),2026,19,85);
        sheetScore(user.getName(),2026,40,5);
        sheetScore(user.getName(),2027,1,25);
        String text="이름\t19주차\t40주차\t41주차\n가상 이관\t999\t70\t100\n가상 미가입\t999\t0\t";
        assertThrows(AppException.class,()->importer.apply(request(text,null)));
        var preview=importer.preview(request(text,null));
        assertEquals(3,preview.get("rows")); assertEquals(170L,preview.get("total"));
        assertEquals(1L,preview.get("zeroRows")); assertEquals(1,preview.get("blankCells"));
        assertEquals(1,preview.get("excludedColumns")); assertEquals(1,preview.get("replacedRows"));
        assertEquals(List.of("가상 미가입"),preview.get("unmatchedNames"));
        assertEquals(3,legacy.count()); // Preview is read-only.
        importer.apply(request(text,(String)preview.get("previewToken")));
        assertEquals(5,legacy.count()); assertEquals(1,records.count());
        assertEquals(85,legacy.findAllByInfoYear(2026).stream().filter(s->s.getWeekNum()==19).findFirst().orElseThrow().getScore());
        assertEquals(25,legacy.findAllByInfoYear(2027).get(0).getScore());
        var again=importer.preview(request(text,null));
        importer.apply(request(text,(String)again.get("previewToken")));
        assertEquals(5,legacy.count()); // Repeating the import cannot add duplicates.
        assertEquals(170,tts.getQuarterlyScores(2026,4).stream().mapToInt(p->(Integer)p.get("totalScore")).sum());
    }

    @Test void importedBlankDoesNotResurrectAppScoreOrInventZeroRecord() {
        var blank=teacher("가상 빈칸","blank",true);
        var zero=teacher("가상 영점","zero",true);
        appScore(blank,2026,40,50); appScore(zero,2026,40,60);
        String text="이름\t40주차\t41주차\n가상 빈칸\t\t10\n가상 영점\t0\t20";
        var preview=importer.preview(request(text,null));
        assertEquals(1,((List<?>)preview.get("appOnly")).size());
        assertEquals(1,((List<?>)preview.get("conflicts")).size());
        importer.apply(request(text,(String)preview.get("previewToken")));
        var blankStats=people(2026).stream().filter(p->Objects.equals(blank.getId(),p.get("teacherId"))).findFirst().orElseThrow();
        var zeroStats=people(2026).stream().filter(p->Objects.equals(zero.getId(),p.get("teacherId"))).findFirst().orElseThrow();
        assertEquals(Map.of(41,10),weekly(blankStats));
        assertEquals(Map.of(40,0,41,20),weekly(zeroStats));
        var week=tts.getWeek(blank,TtsPeriod.sunday(2026,40));
        assertTrue(week.isImportedPeriod()); assertNull(week.getImportedScore());
        assertEquals(0,week.getScore()); assertEquals(2,records.count());
        assertThrows(AppException.class,()->tts.saveAnswer(blank,new com.newaveflow.dto.tts.TtsAnswerRequest(TtsPeriod.sunday(2026,40),questions.findAll().get(0).getId(),"false")));
    }

    @Test void stalePreviewStopsBeforeDeletingAnySavedRows() {
        var user=teacher("가상 변경","stale",true);
        sheetScore(user.getName(),2026,40,9);
        String text="이름,40주차,41주차\n가상 변경,70,100";
        var preview=importer.preview(request(text,null));
        appScore(user,2026,41,80);
        assertThrows(AppException.class,()->importer.apply(request(text,(String)preview.get("previewToken"))));
        assertEquals(1,legacy.count()); assertEquals(9,legacy.findAll().get(0).getScore());
        var current=importer.preview(request(text,null));
        assertThrows(AppException.class,()->importer.apply(request(text.replace("70","71"),(String)current.get("previewToken"))));
        assertEquals(1,legacy.count());
    }

    @Test void malformedOrEmptyReplacementCannotChangeStoredScores() {
        sheetScore("가상 보존",2026,40,90);
        for(String text:List.of(
                "이름,40주차,40주차,41주차\n가상,1,2,3",
                "이름,40주차,41주차\n가상,1,2\n가상,3,4",
                "이름,40주차,41주차\n가상,1.5,2",
                "이름,40주차,41주차\n가상,-1,2",
                "이름,40주차,41주차\n가상,,2",
                "이름,40주차\n가상,1")) {
            assertThrows(AppException.class,()->importer.preview(request(text,null)));
            assertEquals(1,legacy.count());
        }
        assertThrows(AppException.class,()->importer.preview(new com.newaveflow.dto.tts.TtsImportRequest(2026,1,41,"이름,40주차,41주차\n가상,1,2",null)));
        assertThrows(AppException.class,()->importer.preview(new com.newaveflow.dto.tts.TtsImportRequest(2027,40,41,"이름,40주차,41주차\n가상,1,2",null)));
    }
}
