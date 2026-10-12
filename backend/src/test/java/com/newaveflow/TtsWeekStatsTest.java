package com.newaveflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(showSql = false) @ActiveProfiles("test")
@Import({TtsService.class, TtsQuestionPolicy.class, HistoryAndReportingTest.JsonConfig.class})
class TtsWeekStatsTest {
    @Autowired TtsService tts;
    @Autowired UserRepository users;
    @Autowired TtsQuestionRepository questions;
    @Autowired TtsRecordRepository records;
    @Autowired TtsLegacyScoreRepository legacy;
    @Autowired MeetingAttendanceRepository meetings;
    @Autowired PrayerVoteRepository prayers;
    @Autowired ObjectMapper json;

    User teacher(String name) {
        return users.saveAndFlush(User.builder().name(name).email(name + "@example.invalid")
                .password("synthetic-private-password").role(User.Role.TEACHER).isActive(true).build());
    }
    TtsQuestion question(String title, TtsQuestion.TtsQuestionType type, int points) {
        return questions.saveAndFlush(TtsQuestion.builder().title(title).type(type).points(points).build());
    }
    void record(User u, TtsQuestion q, int week, String answer) {
        var record = TtsRecord.builder().teacher(u).infoYear(2026).weekNum(week).build();
        record.addAnswer(TtsAnswer.builder().question(q).answerData(answer).build());
        records.saveAndFlush(record);
    }

    @Test void detailsMatchDailyLinkedAndTotalWithoutExposingAccountFields() throws Exception {
        var teacher = teacher("가상 세부");
        var daily = question("말씀", TtsQuestion.TtsQuestionType.DAYS, 5);
        var linked = questions.saveAndFlush(TtsQuestion.builder().title("회의").type(TtsQuestion.TtsQuestionType.ATTEND)
                .linkType(TtsQuestion.TtsLinkType.SAT_MEETING).points(10).build());
        record(teacher, daily, 41, "{\"월\":true,\"수\":true,\"금\":false}");
        meetings.saveAndFlush(MeetingAttendance.builder().teacher(teacher).meetingDate(TtsPeriod.sunday(2026,41).plusDays(6)).status("ATTEND").build());
        var week = tts.getWeekStats(2026,41);
        var person = week.people().get(0);
        assertEquals(20, person.score()); assertEquals(40, week.maxScore());
        assertEquals(person.score(), person.items().stream().mapToInt(i -> i.score()).sum());
        var detail = person.items().stream().filter(i -> i.questionId().equals(daily.getId())).findFirst().orElseThrow();
        assertEquals(List.of("월","수"), detail.days()); assertEquals(10, detail.score());
        assertTrue(person.items().stream().filter(i -> i.questionId().equals(linked.getId())).findFirst().orElseThrow().checked());
        String payload = json.writeValueAsString(week);
        assertFalse(payload.contains("@example.invalid")); assertFalse(payload.contains("password"));
        assertEquals(1, records.count()); // Detail lookup is read-only.
    }

    @Test void savedZeroAndNoRecordRemainDifferentInBothSummaryAndDetail() {
        var zero = teacher("가상 영점"); var missing = teacher("가상 빈칸");
        record(zero, question("예배", TtsQuestion.TtsQuestionType.ATTEND,10),41,"false");
        var people = tts.getWeekStats(2026,41).people();
        assertEquals(0, people.stream().filter(p -> p.teacherId().equals(zero.getId())).findFirst().orElseThrow().score());
        assertNull(people.stream().filter(p -> p.teacherId().equals(missing.getId())).findFirst().orElseThrow().score());
        assertEquals(0, tts.getQuarterlyScores(2026,4).stream().filter(p -> p.get("teacherId").equals(zero.getId())).findFirst().orElseThrow().get("totalScore"));
    }

    @Test void importedWeeksNeverInventDetailsOrReviveAppRecordsForBlankCells() {
        var blank = teacher("가상 시트빈칸"); var zero = teacher("가상 시트영점");
        record(blank,question("예배",TtsQuestion.TtsQuestionType.ATTEND,10),40,"true");
        legacy.saveAndFlush(TtsLegacyScore.builder().name(zero.getName()).infoYear(2026).weekNum(40).score(0).build());
        legacy.saveAndFlush(TtsLegacyScore.builder().name("가상 미가입").infoYear(2026).weekNum(40).score(95).build());
        var week = tts.getWeekStats(2026,40);
        assertTrue(week.importedPeriod()); assertNull(week.maxScore());
        assertTrue(week.people().stream().allMatch(p -> p.items().isEmpty() && p.updatedAt() == null && p.source().equals("SHEET")));
        assertNull(week.people().stream().filter(p -> Objects.equals(p.teacherId(),blank.getId())).findFirst().orElseThrow().score());
        assertEquals(0,week.people().stream().filter(p -> Objects.equals(p.teacherId(),zero.getId())).findFirst().orElseThrow().score());
        assertEquals(95,week.people().stream().filter(p -> p.teacherId() == null).findFirst().orElseThrow().score());
    }

    @Test void detailRejectsInvalidUnmanagedAndFuturePeriods() {
        assertThrows(AppException.class, () -> tts.getWeekStats(2026,53));
        assertThrows(AppException.class, () -> tts.getWeekStats(2026,39));
        assertThrows(AppException.class, () -> tts.getWeekStats(LocalDate.now().getYear()+1,1));
    }

    @Test void linkedMeetingsIgnoreOldManualChecksOtherPeopleAndOtherWeeks() {
        var person=teacher("가상 연동");var other=teacher("가상 다른 교사");
        var meeting=questions.saveAndFlush(TtsQuestion.builder().title("교사회의").type(TtsQuestion.TtsQuestionType.ATTEND).points(10).linkType(TtsQuestion.TtsLinkType.SAT_MEETING).build());
        var prayer=questions.saveAndFlush(TtsQuestion.builder().title("줌 기도모임").type(TtsQuestion.TtsQuestionType.ATTEND).points(10).linkType(TtsQuestion.TtsLinkType.PRAYER_MEETING).build());
        var sunday=TtsService.weekSunday(LocalDate.now());
        var old=TtsRecord.builder().teacher(person).infoYear(TtsService.weekYear(sunday)).weekNum(TtsService.weekNum(sunday)).build();
        old.addAnswer(TtsAnswer.builder().question(meeting).answerData("true").build());
        old.addAnswer(TtsAnswer.builder().question(prayer).answerData("true").build());records.saveAndFlush(old);
        meetings.saveAndFlush(MeetingAttendance.builder().teacher(person).meetingDate(sunday.minusDays(1)).status("ATTEND").build());
        prayers.saveAndFlush(PrayerVote.builder().teacher(person).weekStart(sunday.minusDays(6)).status(PrayerVote.Status.TUE).build());
        meetings.saveAndFlush(MeetingAttendance.builder().teacher(other).meetingDate(sunday.plusDays(6)).status("ATTEND").build());
        prayers.saveAndFlush(PrayerVote.builder().teacher(other).weekStart(sunday.plusDays(1)).status(PrayerVote.Status.THU).build());
        var unchecked=tts.getWeek(person,sunday);
        assertEquals(0,unchecked.getScore());assertTrue(unchecked.getLinked().stream().noneMatch(x->x.isChecked()));
        var m=meetings.saveAndFlush(MeetingAttendance.builder().teacher(person).meetingDate(sunday.plusDays(6)).status("ABSENT").build());
        var p=prayers.saveAndFlush(PrayerVote.builder().teacher(person).weekStart(sunday.plusDays(1)).status(PrayerVote.Status.ABSENT).build());
        assertEquals(0,tts.getWeek(person,sunday).getScore());
        m.updateStatus("ATTEND","");p.update(PrayerVote.Status.TUE,"");meetings.saveAndFlush(m);prayers.saveAndFlush(p);
        var checked=tts.getWeek(person,sunday);
        assertEquals(20,checked.getScore());assertTrue(checked.getLinked().stream().allMatch(x->x.isChecked()));
        m.updateStatus("ABSENT","");p.update(PrayerVote.Status.ABSENT,"");meetings.saveAndFlush(m);prayers.saveAndFlush(p);
        assertEquals(0,tts.getWeek(person,sunday).getScore());assertEquals(2,records.findById(old.getId()).orElseThrow().getAnswers().size());
    }
}
