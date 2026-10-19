package com.newaveflow;

import com.newaveflow.dto.tts.TtsAnswerRequest;
import com.newaveflow.dto.tts.TtsImportRequest;
import com.newaveflow.dto.event.EventDto.MeetingAttendanceRequest;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(showSql = false) @ActiveProfiles("test")
@Import({TtsService.class, TtsQuestionPolicy.class, TtsLegacyImportService.class, MeetingService.class, PrayerVoteService.class, HistoryAndReportingTest.JsonConfig.class})
class TtsCalendarQuarterTest {
    @Autowired TtsService tts;
    @Autowired TtsLegacyImportService importer;
    @Autowired UserRepository users;
    @Autowired TtsQuestionRepository questions;
    @Autowired TtsRecordRepository records;
    @Autowired TtsLegacyScoreRepository legacy;
    @Autowired MeetingAttendanceRepository meetings;
    @Autowired PrayerVoteRepository prayers;
    @Autowired TtsLinkedSnapshotRepository snapshots;
    @Autowired MeetingService meetingService;
    @Autowired PrayerVoteService prayerService;
    @Autowired PlatformTransactionManager transactionManager;

    @BeforeEach void before() { now("2027-04-01T03:00:00Z"); }
    @AfterEach void resetClock() {
        ReflectionTestUtils.setField(tts, "clock", Clock.system(TtsPeriod.ZONE));
        ReflectionTestUtils.setField(importer, "clock", Clock.system(TtsPeriod.ZONE));
    }
    void now(String instant) {
        var fixed=Clock.fixed(Instant.parse(instant), ZoneOffset.UTC);
        ReflectionTestUtils.setField(tts, "clock", fixed);
        ReflectionTestUtils.setField(importer, "clock", fixed);
    }
    User teacher(String name) { return users.saveAndFlush(User.builder().name(name).email(name + "@example.invalid")
            .password("synthetic").role(User.Role.TEACHER).isActive(true).build()); }
    TtsQuestion question(String name, TtsQuestion.TtsQuestionType type, TtsQuestion.TtsLinkType link) {
        return questions.saveAndFlush(TtsQuestion.builder().title(name).type(type).linkType(link).points(type == TtsQuestion.TtsQuestionType.DAYS ? 5 : 10).build());
    }
    TtsQuestion daily() { return question("가상 말씀", TtsQuestion.TtsQuestionType.DAYS, TtsQuestion.TtsLinkType.NONE); }
    TtsQuestion weekly() { return question("가상 참여", TtsQuestion.TtsQuestionType.ATTEND, TtsQuestion.TtsLinkType.NONE); }
    void seed(User user, LocalDate sunday, TtsQuestion q, String answer) {
        var r = records.findByTeacherIdAndInfoYearAndWeekNum(user.getId(), TtsService.weekYear(sunday), TtsService.weekNum(sunday))
                .orElseGet(() -> TtsRecord.builder().teacher(user).infoYear(TtsService.weekYear(sunday)).weekNum(TtsService.weekNum(sunday)).build());
        r.addAnswer(TtsAnswer.builder().question(q).answerData(answer).build()); records.saveAndFlush(r);
    }
    void save(User u, LocalDate sunday, TtsQuestion q, String answer) { tts.saveAnswer(u, new TtsAnswerRequest(sunday, q.getId(), answer)); }
    int total(User u, int year, int quarter) { return (Integer) tts.getQuarterlyScores(year, quarter).stream()
            .filter(p -> Objects.equals(u.getId(), p.get("teacherId"))).findFirst().orElseThrow().get("totalScore"); }

    @Test void boundaryWeekAllowsOnlyCurrentQuarterDaysAndPreservesClosedChecks() {
        var u = teacher("부분잠금"); var q = daily(); var sunday = LocalDate.of(2027,3,28);
        seed(u, sunday, q, "{\"월\":true,\"수\":true}");
        var response = tts.getWeek(u, sunday);
        assertEquals(LocalDate.of(2027,4,1), response.getServerToday());
        assertEquals(List.of("목"), response.getEditableDays());
        assertFalse(response.isClosedQuarter()); assertTrue(response.isAttendanceEditable());
        save(u, sunday, q, "{\"월\":true,\"수\":true,\"목\":true}");
        assertEquals(15, tts.getWeek(u, sunday).getScore());
        assertThrows(AppException.class, () -> save(u, sunday, q, "{\"수\":true,\"목\":true}"));
        assertThrows(AppException.class, () -> save(u, sunday, q, "{\"월\":true,\"화\":true,\"수\":true,\"목\":true}"));
        assertEquals(15, tts.getWeek(u, sunday).getScore());
        assertThrows(AppException.class, () -> save(u, sunday, q, "{\"월\":true,\"수\":true,\"목\":true,\"금\":true}"));
    }

    @Test void koreanMidnightClosesTheQuarterForEveryRoleButKeepsReadAccess() {
        var q = daily(); var sunday = LocalDate.of(2027,3,21);
        for (var role : User.Role.values()) {
            var u = users.saveAndFlush(User.builder().name("마감" + role).email(role + "@example.invalid")
                    .password("synthetic").role(role).isActive(true).build());
            now("2027-03-31T14:59:59Z"); save(u, sunday, q, "{\"월\":true}");
            now("2027-03-31T15:00:00Z");
            assertThrows(AppException.class, () -> save(u, sunday, q, "{}"));
            assertTrue(tts.getWeek(u,sunday).isClosedQuarter());
            assertEquals(5, tts.getWeek(u,sunday).getScore());
            assertEquals(5,total(u,2027,1));
        }
    }

    @Test void earlierWeeksInCurrentQuarterRemainEditableButFutureWeeksAndSundayKeysDoNot() {
        var u=teacher("현재분기"); var q=daily(); now("2027-05-20T03:00:00Z");
        save(u, LocalDate.of(2027,4,4),q,"{\"월\":true}");
        save(u, LocalDate.of(2027,4,4),q,"{\"월\":true,\"화\":true}");
        assertEquals(10,tts.getWeek(u,LocalDate.of(2027,4,4)).getScore());
        assertThrows(AppException.class,()->save(u,LocalDate.of(2027,5,23),q,"{}"));
        assertThrows(AppException.class,()->save(u,LocalDate.of(2027,5,16),q,"{\"일\":true}"));
    }

    @Test void undatedWeeklyActivityBelongsToSaturdayAndCannotBeEditedInThePreviousQuarter() {
        var u=teacher("토요일귀속"); var q=weekly(); var sunday=LocalDate.of(2027,3,28);
        now("2027-03-31T03:00:00Z");
        assertFalse(tts.getWeek(u,sunday).isAttendanceEditable());
        assertEquals(LocalDate.of(2027,4,3),tts.getWeek(u,sunday).getAttendanceDate());
        assertThrows(AppException.class,()->save(u,sunday,q,"true"));
        now("2027-04-01T03:00:00Z"); save(u,sunday,q,"true");
        assertEquals(0,total(u,2027,1)); assertEquals(10,total(u,2027,2));
    }

    @Test void calendarTotalsAndPartialWeekDetailAgreeWithoutDoubleCountingBoundaryDays() {
        var u=teacher("분기배분"); var daily=daily(); var weekly=weekly(); var sunday=LocalDate.of(2027,3,28);
        seed(u,sunday,daily,"{\"월\":true,\"수\":true,\"목\":true,\"금\":true}"); seed(u,sunday,weekly,"true");
        assertEquals(10,total(u,2027,1)); assertEquals(20,total(u,2027,2));
        var q1=tts.getWeekStats(2027,14,2027,1); var q2=tts.getWeekStats(2027,14,2027,2);
        assertEquals(10,q1.people().get(0).score()); assertEquals(20,q2.people().get(0).score());
        assertEquals(15,q1.maxScore()); assertEquals(25,q2.maxScore());
        assertEquals(List.of("월","화","수"),q1.people().get(0).items().get(0).eligibleDays());
        assertEquals(List.of("목","금","토"),q2.people().get(0).items().get(0).eligibleDays());
        assertEquals(1,q1.people().get(0).items().size()); assertEquals(2,q2.people().get(0).items().size());
        assertEquals(30,tts.getWeekStats(2027,14).people().get(0).score());
        assertThrows(AppException.class,()->tts.getWeekStats(2027,14,2027,3));
    }

    @Test void yearBoundaryReadsNextWeekYearWithoutChangingStoredKeysOrImportedTotals() {
        var u=teacher("연말배분"); var q=daily(); var sunday=LocalDate.of(2026,12,27);
        seed(u,sunday,q,"{\"월\":true,\"화\":true,\"수\":true,\"목\":true,\"금\":true,\"토\":true}"); seed(u,sunday,weekly(),"true");
        legacy.saveAndFlush(TtsLegacyScore.builder().name(u.getName()).infoYear(2026).weekNum(40).score(70).build());
        legacy.saveAndFlush(TtsLegacyScore.builder().name(u.getName()).infoYear(2026).weekNum(41).score(100).build());
        assertEquals(190,total(u,2026,4)); assertEquals(20,total(u,2027,1));
        assertTrue(records.findByTeacherIdAndInfoYearAndWeekNum(u.getId(),2027,1).isPresent());
        assertEquals(1,records.count()); assertEquals(2,legacy.count());
    }

    @Test void quarterlyAggregationKeepsAStoredZeroDifferentFromNoRecord() {
        var zero=teacher("가상영점"); var missing=teacher("가상미기록"); seed(zero,LocalDate.of(2027,3,28),daily(),"{}");
        var data=tts.getQuarterlyScores(2027,1);
        assertFalse(((List<?>)data.stream().filter(p->Objects.equals(zero.getId(),p.get("teacherId"))).findFirst().orElseThrow().get("weeklyScores")).isEmpty());
        assertTrue(((List<?>)data.stream().filter(p->Objects.equals(missing.getId(),p.get("teacherId"))).findFirst().orElseThrow().get("weeklyScores")).isEmpty());
    }

    @Test void oldMeetingEditsPreserveBothTrueAndFalseTtsResultsWithoutBlockingSourceEdits() {
        question("가상 연동회의",TtsQuestion.TtsQuestionType.ATTEND,TtsQuestion.TtsLinkType.SAT_MEETING);
        var yes=teacher("이전참석"); var no=teacher("이전미참석"); var saturday=LocalDate.of(2027,3,20);
        meetings.saveAndFlush(MeetingAttendance.builder().teacher(yes).meetingDate(saturday).status("ATTEND").build());
        meetingService.saveMeetingAttendance(yes.getId(),new MeetingAttendanceRequest(saturday,"ABSENT","가상 변경"));
        meetingService.saveMeetingAttendance(no.getId(),new MeetingAttendanceRequest(saturday,"ATTEND",null));
        assertEquals("ABSENT",meetings.findByTeacherIdAndMeetingDate(yes.getId(),saturday).orElseThrow().getStatus());
        assertEquals("ATTEND",meetings.findByTeacherIdAndMeetingDate(no.getId(),saturday).orElseThrow().getStatus());
        assertEquals(10,total(yes,2027,1)); assertEquals(0,total(no,2027,1));
        meetingService.saveMeetingAttendance(yes.getId(),new MeetingAttendanceRequest(saturday,"ATTEND",null));
        assertEquals(2,snapshots.count()); assertEquals(10,tts.getWeek(yes,saturday).getScore());
    }

    @Test void oldPrayerEditsPreserveTtsWhileCurrentQuarterEditsStillReflectImmediately() {
        question("가상 연동기도",TtsQuestion.TtsQuestionType.ATTEND,TtsQuestion.TtsLinkType.PRAYER_MEETING);
        var u=teacher("기도보존"); var monday=LocalDate.of(2027,3,15);
        prayers.saveAndFlush(PrayerVote.builder().teacher(u).weekStart(monday).status(PrayerVote.Status.TUE).build());
        prayerService.saveVote(u.getId(),monday,"ABSENT","가상 변경");
        assertEquals(10,total(u,2027,1)); assertEquals(PrayerVote.Status.ABSENT,prayers.findByTeacherIdAndWeekStart(u.getId(),monday).orElseThrow().getStatus());
        Long voteId=prayers.findByTeacherIdAndWeekStart(u.getId(),monday).orElseThrow().getId();
        prayerService.toggleScriptureSubmitted(voteId,true);
        assertEquals(PrayerVote.Status.ABSENT,prayers.findById(voteId).orElseThrow().getStatus());
        assertTrue(prayers.findById(voteId).orElseThrow().isScriptureCopySubmitted());
        assertEquals(10,total(u,2027,1));
        var current=LocalDate.of(2027,3,29);
        prayerService.saveVote(u.getId(),current,"TUE",null); assertEquals(10,total(u,2027,2));
        prayerService.saveVote(u.getId(),current,"ABSENT",null); assertEquals(0,total(u,2027,2));
        assertEquals(1,snapshots.count());
    }

    @Test void accountDeletionCascadesSnapshotsAndReadOnlyStatisticsNeverCreateThem() {
        var u=teacher("스냅샷삭제");
        snapshots.saveAndFlush(TtsLinkedSnapshot.builder().teacher(u).weekStart(LocalDate.of(2027,3,14))
                .linkType(TtsQuestion.TtsLinkType.SAT_MEETING).checked(false).build());
        tts.getStats(2027); tts.getWeek(u,LocalDate.of(2027,3,14)); assertEquals(1,snapshots.count());
        users.delete(u); users.flush(); assertEquals(0,snapshots.count());
    }

    @Test void allCalendarQuarterClosuresUseKoreanMidnightIncludingNewYear() {
        var q=daily();
        for (var end : List.of(LocalDate.of(2026,12,31),LocalDate.of(2027,3,31),LocalDate.of(2027,6,30),LocalDate.of(2027,9,30))) {
            var u=teacher("분기끝"+end); var sunday=TtsService.weekSunday(end.minusWeeks(1));
            now(end.atTime(23,59,59).atZone(TtsPeriod.ZONE).toInstant().toString());
            save(u,sunday,q,"{\"월\":true}");
            now(end.plusDays(1).atStartOfDay(TtsPeriod.ZONE).toInstant().toString());
            assertThrows(AppException.class,()->save(u,sunday,q,"{}"));
            assertEquals(5,tts.getWeek(u,sunday).getScore());
        }
    }

    @Test void newYearLocksDecemberDaysWithinTheSameStoredWeek() {
        var u=teacher("새해부분잠금");var q=daily();var sunday=LocalDate.of(2026,12,27);
        seed(u,sunday,q,"{\"목\":true}"); now("2026-12-31T15:00:00Z");
        assertEquals(List.of("금"),tts.getWeek(u,sunday).getEditableDays());
        save(u,sunday,q,"{\"목\":true,\"금\":true}");
        assertThrows(AppException.class,()->save(u,sunday,q,"{\"금\":true}"));
        assertEquals(5,total(u,2026,4));assertEquals(5,total(u,2027,1));
    }

    @Test void confirmedSheetImportCanBePreviewedButNotChangedAfterItsQuarterCloses() {
        var u=teacher("시트마감");
        legacy.saveAndFlush(TtsLegacyScore.builder().name(u.getName()).infoYear(2026).weekNum(40).score(70).build());
        var request=new TtsImportRequest(2026,40,40,"이름\t40주차\n시트마감\t80",null);
        now("2026-12-31T14:59:59Z");
        String token=(String)importer.preview(request).get("previewToken");
        now("2026-12-31T15:00:00Z");
        assertNotNull(importer.preview(request).get("previewToken"));
        var error=assertThrows(AppException.class,()->importer.apply(new TtsImportRequest(2026,40,40,request.text(),token)));
        assertEquals(403,error.getStatus().value());
        assertEquals(70,legacy.findAllByInfoYear(2026).get(0).getScore());
    }

    @Test @Transactional(propagation=Propagation.NOT_SUPPORTED) @DirtiesContext(methodMode=DirtiesContext.MethodMode.AFTER_METHOD)
    void aFailedSourceTransactionRollsBackItsSnapshotToo() {
        var tx=new TransactionTemplate(transactionManager);var saturday=LocalDate.of(2027,3,20);
        Long id=tx.execute(s->{
            var u=teacher("롤백검수");question("롤백연동",TtsQuestion.TtsQuestionType.ATTEND,TtsQuestion.TtsLinkType.SAT_MEETING);
            meetings.saveAndFlush(MeetingAttendance.builder().teacher(u).meetingDate(saturday).status("ATTEND").build());return u.getId();
        });
        assertThrows(IllegalStateException.class,()->tx.execute(s->{
            meetingService.saveMeetingAttendance(id,new MeetingAttendanceRequest(saturday,"ABSENT",null));
            throw new IllegalStateException("synthetic rollback");
        }));
        tx.execute(s->{assertEquals(0,snapshots.count());
            assertEquals("ATTEND",meetings.findByTeacherIdAndMeetingDate(id,saturday).orElseThrow().getStatus());return null;});
    }

    @Test @Transactional(propagation=Propagation.NOT_SUPPORTED) @DirtiesContext(methodMode=DirtiesContext.MethodMode.AFTER_METHOD)
    void simultaneousSourceEditsCreateExactlyOneOriginalSnapshot() throws Exception {
        var tx=new TransactionTemplate(transactionManager);var saturday=LocalDate.of(2027,3,20);
        Long id=tx.execute(s->{
            var u=teacher("동시검수");question("동시연동",TtsQuestion.TtsQuestionType.ATTEND,TtsQuestion.TtsLinkType.SAT_MEETING);
            meetings.saveAndFlush(MeetingAttendance.builder().teacher(u).meetingDate(saturday).status("ATTEND").build());return u.getId();
        });
        var start=new CountDownLatch(1);var executor=Executors.newFixedThreadPool(2);
        try {
            var first=executor.submit(()->{start.await();return meetingService.saveMeetingAttendance(id,new MeetingAttendanceRequest(saturday,"ABSENT",null));});
            var second=executor.submit(()->{start.await();return meetingService.saveMeetingAttendance(id,new MeetingAttendanceRequest(saturday,"ATTEND",null));});
            start.countDown();first.get(15,TimeUnit.SECONDS);second.get(15,TimeUnit.SECONDS);
        } finally {executor.shutdownNow();}
        tx.execute(s->{assertEquals(1,snapshots.count());assertTrue(snapshots.findAll().get(0).isChecked());
            assertEquals(10,tts.getWeek(users.findById(id).orElseThrow(),saturday).getScore());return null;});
    }
}
