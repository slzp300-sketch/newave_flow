package com.newaveflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.dto.tts.TtsResponse;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.*;
import java.util.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationReminderTest {
    @Mock UserRepository users;
    @Mock NotificationService notifications;
    @Mock EventRepository events;
    @Mock EventRosterService roster;
    @Mock DailyReportRepository reports;
    @Mock MeetingAttendanceRepository meetings;
    @Mock TtsService tts;
    @Mock EvangelismScheduleRepository evangelism;
    @Spy ObjectMapper json=new ObjectMapper();
    @InjectMocks NotificationReminderService service;
    @BeforeEach void enable() { ReflectionTestUtils.setField(service,"enabled",true); }
    User teacher(long id,ClassGroup group) {
        var u=User.builder().id(id).name("Synthetic").email("synthetic"+id+"@example.invalid").role(User.Role.TEACHER).teacherClasses(new ArrayList<>()).build();
        if(group!=null)u.getTeacherClasses().add(TeacherClass.builder().teacher(u).classGroup(group).build());return u;
    }
    @Test void tuesdayUsesSharedClassSubmissionAndSkipsCompletedClassTeachers() {
        var done=ClassGroup.builder().id(1L).name("Done").build();var missing=ClassGroup.builder().id(2L).name("Missing").build();
        var a=teacher(1,done);var b=teacher(2,done);var c=teacher(3,missing);
        when(users.findAllActiveWithClasses()).thenReturn(List.of(a,b,c));
        when(reports.findByReportDate(LocalDate.of(2026,10,18))).thenReturn(List.of(DailyReport.builder().classGroup(done).status(DailyReport.Status.SUBMITTED).build()));
        service.run(LocalDate.of(2026,10,20));
        verify(notifications).enqueue(eq(3L),contains("attendance:2026-10-18"),anyString(),anyString(),eq(Notification.NotificationType.ATTENDANCE),eq("/attendance"));
        verifyNoMoreInteractions(notifications);
    }
    @Test void ttsWednesdayOnlyIncludesUncheckedPastDaysNotTodayOrFuture() {
        var a=teacher(1,null);var b=teacher(2,null);when(users.findAllActiveWithClasses()).thenReturn(List.of(a,b));
        var q=TtsQuestion.builder().id(8L).title("Synthetic").type(TtsQuestion.TtsQuestionType.DAYS).build();
        when(tts.getActiveQuestions(any())).thenReturn(List.of(q));
        when(tts.getWeek(eq(a),any())).thenReturn(TtsResponse.builder().answers(List.of(TtsResponse.AnswerResponse.builder().questionId(8L).answerData("{\"월\":true,\"화\":true}").build())).build());
        when(tts.getWeek(eq(b),any())).thenReturn(TtsResponse.builder().answers(List.of()).build());
        service.run(LocalDate.of(2026,10,14));
        verify(notifications).enqueue(eq(2L),contains("tts:"),anyString(),anyString(),eq(Notification.NotificationType.TTS),eq("/tts"));
        verifyNoMoreInteractions(notifications);
    }
    @Test void ttsNewQuarterDoesNotRemindClosedQuarterDays() {
        var a=teacher(1,null);when(users.findAllActiveWithClasses()).thenReturn(List.of(a));
        when(tts.getActiveQuestions(any())).thenReturn(List.of(TtsQuestion.builder().id(8L).title("Synthetic").type(TtsQuestion.TtsQuestionType.DAYS).build()));
        when(tts.getWeek(eq(a),any())).thenReturn(TtsResponse.builder().answers(List.of(TtsResponse.AnswerResponse.builder()
                .questionId(8L).answerData("{\"목\":true,\"금\":true}").build())).build());
        service.run(LocalDate.of(2027,7,3)); // Mon-Wed are closed Q2; Thu/Fri checked; today is not overdue.
        verifyNoInteractions(notifications);
    }
    @Test void fridayOnlyUnansweredMeetingVoteAndCurrentUncanceledEvangelism() {
        var answered=teacher(1,null);var missing=teacher(2,null);when(users.findAllActiveWithClasses()).thenReturn(List.of(answered,missing));
        when(meetings.findByMeetingDate(LocalDate.of(2026,10,17))).thenReturn(List.of(MeetingAttendance.builder().teacher(answered).status("ABSENT").build()));
        var due=EvangelismSchedule.builder().id(7L).scheduledDate(LocalDate.of(2026,10,17)).assignments(List.of(EvangelismAssignment.builder().teacher(answered).build())).build();
        var canceled=EvangelismSchedule.builder().id(8L).status("CANCELED").scheduledDate(LocalDate.of(2026,10,17)).build();
        var later=EvangelismSchedule.builder().id(9L).scheduledDate(LocalDate.of(2026,10,24)).build();
        var sunday=EvangelismSchedule.builder().id(10L).scheduledDate(LocalDate.of(2026,10,18)).assignments(List.of(EvangelismAssignment.builder().teacher(answered).build())).build();
        when(evangelism.findUpcomingWithAssignments(LocalDate.of(2026,10,16))).thenReturn(List.of(due,canceled,later,sunday));
        service.run(LocalDate.of(2026,10,16));
        verify(notifications).enqueue(eq(2L),eq("meeting-vote:2026-10-17"),anyString(),anyString(),eq(Notification.NotificationType.MEETING_VOTE),eq("/meeting/sat"));
        verify(notifications).enqueue(eq(1L),eq("evangelism:7:2026-10-17:2026-10-16"),anyString(),startsWith("내일 전도 로테이션입니다."),eq(Notification.NotificationType.EVANGELISM),eq("/evangelism"));
        verify(notifications).enqueue(eq(1L),contains("evangelism:10:"),anyString(),startsWith("10월 18일 전도 로테이션입니다."),eq(Notification.NotificationType.EVANGELISM),eq("/evangelism"));
        when(evangelism.findUpcomingWithAssignments(LocalDate.of(2026,10,12))).thenReturn(List.of(due));
        service.run(LocalDate.of(2026,10,12));
        verify(notifications).enqueue(eq(1L),eq("evangelism:7:2026-10-17:2026-10-12"),anyString(),startsWith("이번 주 전도 로테이션입니다."),eq(Notification.NotificationType.EVANGELISM),eq("/evangelism"));
        verifyNoMoreInteractions(notifications);
    }
    @Test void noWorkOrDatabaseReadWhenDisabled() {
        ReflectionTestUtils.setField(service,"enabled",false);service.run(LocalDate.of(2026,10,16));
        verifyNoInteractions(users,events,notifications,tts,meetings,reports,evangelism);
    }
    @Test void eventDeadlineOnlyNotifiesUnansweredTeacherAtD3AndD0() {
        var a=teacher(1,null);var b=teacher(2,null);when(users.findAllActiveWithClasses()).thenReturn(List.of(a,b));
        var event=Event.builder().id(10L).title("Synthetic").eventDate(LocalDate.of(2026,10,20)).attendanceRequired(true)
                .attendanceTarget(Event.AttendanceTarget.TEACHER_ONLY).attendanceStartDate(LocalDate.of(2026,10,1))
                .attendanceDeadline(LocalDate.of(2026,10,18)).build();
        when(events.findByAttendanceRequiredTrueOrderByEventDateDesc()).thenReturn(List.of(event));
        when(roster.teacherSummary(10L)).thenReturn(List.of(
                new com.newaveflow.dto.event.EventDto.TeacherAttendanceRecord(1L,"Synthetic",null,"ABSENT",null,null,null),
                new com.newaveflow.dto.event.EventDto.TeacherAttendanceRecord(2L,"Synthetic",null,null,null,null,null)));
        service.run(LocalDate.of(2026,10,15));
        verify(notifications).enqueue(eq(2L),eq("event-deadline:10:2026-10-18:2026-10-15"),anyString(),anyString(),eq(Notification.NotificationType.EVENT_DEADLINE),eq("/event-attendance/10"));
        service.run(LocalDate.of(2026,10,18));
        verify(notifications).enqueue(eq(2L),eq("event-deadline:10:2026-10-18:2026-10-18"),anyString(),anyString(),eq(Notification.NotificationType.EVENT_DEADLINE),eq("/event-attendance/10"));
        verifyNoMoreInteractions(notifications);
    }
}
