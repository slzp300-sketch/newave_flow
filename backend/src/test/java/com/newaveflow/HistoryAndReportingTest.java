package com.newaveflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.dto.attendance.AttendanceBatchRequest;
import com.newaveflow.dto.event.EventDto;
import com.newaveflow.dto.tts.*;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.*;
import org.springframework.test.context.ActiveProfiles;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(showSql = false) @ActiveProfiles("test")
@Import({AttendanceService.class, ReportService.class, ClassAccessService.class, EventService.class, EventRosterService.class,
        TtsService.class, TtsQuestionPolicy.class, HistoryAndReportingTest.JsonConfig.class})
class HistoryAndReportingTest {
    @TestConfiguration static class JsonConfig { @Bean ObjectMapper mapper() { return new ObjectMapper().findAndRegisterModules(); } }
    @MockBean NotificationService notifications;
    @Autowired UserRepository users;
    @Autowired ClassGroupRepository classes;
    @Autowired StudentRepository students;
    @Autowired TeacherClassRepository assignments;
    @Autowired DailyReportRepository reports;
    @Autowired AttendanceService attendance;
    @Autowired ReportService reporting;
    @Autowired EventService events;
    @Autowired TtsService tts;
    @Autowired TtsQuestionPolicy policy;
    @Autowired TtsQuestionRepository questions;
    @Autowired TtsRecordRepository records;
    @Autowired MeetingAttendanceRepository meetings;
    @Autowired EntityManager em;

    User account(String suffix) { return users.saveAndFlush(User.builder().name("검증 " + suffix).email(suffix+"@example.invalid").password("synthetic").role(User.Role.TEACHER).build()); }
    ClassGroup group(String name) { return classes.saveAndFlush(ClassGroup.builder().name(name).ageGroup("검증 학년").build()); }
    Student student(ClassGroup group) { return students.saveAndFlush(Student.builder().name("검증 학생").grade("검증 학년").classGroup(group).build()); }
    void assign(User u, ClassGroup c, boolean primary) { assignments.saveAndFlush(TeacherClass.builder().teacher(u).classGroup(c).isPrimary(primary).build()); }

    @Test void twoTeachersShareOneSubmittedReportAndCountsStayAccurate() {
        var first = account("first"); var second = account("second"); var c=group("검증 반"); var s=student(c);
        assign(first,c,true); assign(second,c,false);
        LocalDate day=LocalDate.of(2026,1,4);
        var batch=new AttendanceBatchRequest(c.getId(),day,List.of(new AttendanceBatchRequest.Record(s.getId(),"PRESENT","","")));
        attendance.saveBatch(batch,first.getId()); attendance.submitReport(c.getId(),day,first.getId());
        attendance.saveBatch(batch,second.getId()); attendance.submitReport(c.getId(),day,second.getId());
        em.flush(); em.clear();
        assertEquals(1,reports.findByClassGroupIdAndReportDate(c.getId(),day).size());
        var summary=attendance.getAdminWeeklySummary(day);
        assertEquals(1,summary.size()); assertEquals(1,summary.get(0).totalStudents()); assertEquals(1,summary.get(0).presentCount());
        assertEquals(DailyReport.Status.SUBMITTED,reporting.getByClassAndDate(c.getId(),day).getStatus());
        assertEquals(2,reporting.getSummary(day).submitted()); assertEquals(0,reporting.getSummary(day).notSubmittedCount());
    }

    @Test void eventRosterSurvivesTransferDeactivationAndLaterEnrollment() {
        var teacher=account("teacher"); var original=group("등록 당시 반"); var moved=group("이동한 반"); var s=student(original);
        assign(teacher,original,true);
        LocalDate day=LocalDate.of(2026,1,4);
        var event=events.createEvent(new EventDto.EventCreateRequest("검증 행사",null,day,day.plusDays(2),null,null,null,"SPECIAL",true,null,"BOTH"));
        events.saveStudentAttendanceBatch(event.id(),teacher.getId(),List.of(new EventDto.StudentAttendanceItem(s.getId(),"PRESENT",null,null,null)));
        s.assignClass(moved); s.deactivate(); student(original); em.flush(); em.clear();
        var rows=events.getStudentAttendanceSummary(event.id());
        assertEquals(1,rows.size()); assertEquals("등록 당시 반",rows.get(0).classGroupName());
        assertEquals(1,rows.get(0).totalCount()); assertEquals(1,rows.get(0).presentCount());
        assertEquals(s.getId(),events.getMyClassAttendance(event.id(),teacher.getId()).get(0).studentId());
    }

    @Test void manualAndLinkedHistoricalScoresSurviveQuestionChanges() {
        var teacher=account("scores"); LocalDate sunday=TtsService.weekSunday(LocalDate.now()).minusWeeks(1);
        var daily=questions.saveAndFlush(TtsQuestion.builder().title("검증 매일").type(TtsQuestion.TtsQuestionType.DAYS).points(5).displayOrder(1).build());
        var linked=questions.saveAndFlush(TtsQuestion.builder().title("검증 회의").type(TtsQuestion.TtsQuestionType.ATTEND).points(10)
                .linkType(TtsQuestion.TtsLinkType.SAT_MEETING).displayOrder(2).build());
        meetings.saveAndFlush(MeetingAttendance.builder().teacher(teacher).meetingDate(sunday.plusDays(6)).status("ATTEND").build());
        tts.saveAnswer(teacher,new TtsAnswerRequest(sunday,daily.getId(),"{\"월\":true}"));
        assertEquals(15,tts.getWeek(teacher,sunday).getScore());
        tts.updateQuestions(List.of(TtsQuestion.builder().id(daily.getId()).title("변경 매일").type(TtsQuestion.TtsQuestionType.DAYS).points(50).displayOrder(1).build(),
                TtsQuestion.builder().id(linked.getId()).title("변경 회의").type(TtsQuestion.TtsQuestionType.ATTEND).points(100).linkType(TtsQuestion.TtsLinkType.SAT_MEETING).displayOrder(2).build()));
        em.flush(); em.clear();
        assertEquals(15,tts.getWeek(teacher,sunday).getScore());
        assertEquals(5,tts.getActiveQuestions(sunday).get(0).getPoints());
        assertEquals(50,policy.load().at(TtsService.weekSunday(LocalDate.now()).plusWeeks(1)).get(0).getPoints());
    }

    @Test void legacySubmitAndInvalidDayCannotCreateScores() {
        var teacher=account("validation"); var q=questions.saveAndFlush(TtsQuestion.builder().title("검증").type(TtsQuestion.TtsQuestionType.DAYS).points(5).build());
        assertThrows(AppException.class,()->tts.submitTts(teacher,new TtsSubmitRequest(2099,40,List.of(new TtsSubmitRequest.AnswerRequest(q.getId(),"{\"invalid\":true}")))));
        assertThrows(AppException.class,()->tts.saveAnswer(teacher,new TtsAnswerRequest(LocalDate.now().minusWeeks(1),q.getId(),"{\"invalid\":true}")));
        assertEquals(0,records.count());
    }
}
