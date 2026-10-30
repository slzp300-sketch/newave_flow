package com.newaveflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.dto.tts.TtsResponse;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationEligibilityTest {
    @Mock EventRepository events; @Mock EventRosterService roster; @Mock DailyReportRepository reports;
    @Mock MeetingAttendanceRepository meetings; @Mock MeetingMinuteRepository minutes; @Mock EvangelismScheduleRepository evangelism;
    @Mock TtsService tts; @Spy ObjectMapper json=new ObjectMapper();
    @InjectMocks NotificationEligibilityService eligibility;
    Notification notice(Notification.NotificationType type,String key) { return Notification.builder().type(type).dedupeKey(key).build(); }
    User user() { return User.builder().id(1L).role(User.Role.TEACHER).teacherClasses(new ArrayList<>()).build(); }

    @Test void submittedSharedReportCancelsOtherTeachersReminder() {
        var u=user();var group=ClassGroup.builder().id(5L).build();u.getTeacherClasses().add(TeacherClass.builder().teacher(u).classGroup(group).build());
        var notice=notice(Notification.NotificationType.ATTENDANCE,"attendance:2026-10-18:2026-10-20");
        var day=LocalDate.of(2026,10,20);
        assertTrue(eligibility.relevant(notice,u,day));
        when(reports.findByReportDate(LocalDate.of(2026,10,18))).thenReturn(List.of(DailyReport.builder().classGroup(group).status(DailyReport.Status.SUBMITTED).build()));
        assertFalse(eligibility.relevant(notice,u,day));
    }
    @Test void submittedMeetingVoteAndHiddenMinutesCancelTheirPush() {
        var u=user();var day=LocalDate.of(2026,10,16);var saturday=day.plusDays(1);
        when(meetings.findByTeacherIdAndMeetingDate(1L,saturday)).thenReturn(Optional.of(MeetingAttendance.builder().teacher(u).status("ABSENT").build()));
        assertFalse(eligibility.relevant(notice(Notification.NotificationType.MEETING_VOTE,"meeting-vote:2026-10-17"),u,day));
        var minute=MeetingMinute.builder().id(9L).meetingDate(saturday).build();when(minutes.findById(9L)).thenReturn(Optional.of(minute));
        var notice=notice(Notification.NotificationType.MINUTE,"minute-published:9");assertTrue(eligibility.relevant(notice,u,day));
        minute.setActive(false);assertFalse(eligibility.relevant(notice,u,day));
    }
    @Test void deletedOrChangedEventCannotSendOldReminder() {
        var u=user();var day=LocalDate.of(2026,10,15);
        assertFalse(eligibility.relevant(notice(Notification.NotificationType.EVENT,"event-new:9"),u,day));
        var event=Event.builder().id(9L).attendanceRequired(true).attendanceDeadline(LocalDate.of(2026,10,19)).build();
        when(events.findById(9L)).thenReturn(Optional.of(event));
        assertFalse(eligibility.relevant(notice(Notification.NotificationType.EVENT_DEADLINE,"event-deadline:9:2026-10-18:2026-10-15"),u,day));
        verifyNoInteractions(roster);
    }
    @Test void canceledOrReassignedEvangelismIsNoLongerRelevant() {
        var u=user();var s=EvangelismSchedule.builder().id(9L).scheduledDate(LocalDate.of(2026,10,17)).assignments(List.of(EvangelismAssignment.builder().teacher(u).build())).build();
        when(evangelism.findById(9L)).thenReturn(Optional.of(s));var n=notice(Notification.NotificationType.EVANGELISM,"evangelism:9:2026-10-17:2026-10-16");
        assertTrue(eligibility.relevant(n,u,LocalDate.of(2026,10,16)));s.cancel();assertFalse(eligibility.relevant(n,u,LocalDate.of(2026,10,16)));
    }
    @Test void completedTtsAndOldReminderDateAreRejected() {
        var u=user();var day=LocalDate.of(2026,10,14);var n=notice(Notification.NotificationType.TTS,"tts:2026-10-11:2026-10-14");
        when(tts.getActiveQuestions(any())).thenReturn(List.of(TtsQuestion.builder().id(4L).type(TtsQuestion.TtsQuestionType.DAYS).build()));
        when(tts.getWeek(eq(u),any())).thenReturn(TtsResponse.builder().answers(List.of(TtsResponse.AnswerResponse.builder().questionId(4L).answerData("{\"월\":true,\"화\":true}").build())).build());
        assertFalse(eligibility.relevant(n,u,day));assertFalse(eligibility.relevant(n,u,day.plusDays(1)));
    }
    @Test void transientReadFailureIsRetriedInsteadOfCancelingTheReminder() {
        when(events.existsById(9L)).thenThrow(new org.springframework.dao.DataAccessResourceFailureException("Synthetic unavailable database"));
        assertThrows(org.springframework.dao.DataAccessResourceFailureException.class,
                () -> eligibility.relevant(notice(Notification.NotificationType.EVENT,"event-new:9"),user(),LocalDate.of(2026,10,16)));
        assertFalse(eligibility.relevant(notice(Notification.NotificationType.EVENT,"event-new:invalid"),user(),LocalDate.of(2026,10,16)));
    }
    @Test void ttsRetryDoesNotReintroducePreviousQuarterOrTodayChecks() {
        var u=user();
        when(tts.getActiveQuestions(any())).thenReturn(List.of(TtsQuestion.builder().id(4L).type(TtsQuestion.TtsQuestionType.DAYS).build()));
        when(tts.getWeek(eq(u),any())).thenReturn(TtsResponse.builder().answers(List.of(
                TtsResponse.AnswerResponse.builder().questionId(4L).answerData("{\"목\":true,\"금\":true}").build())).build());
        assertFalse(eligibility.relevant(notice(Notification.NotificationType.TTS,"tts:2027-06-27:2027-07-03"),u,LocalDate.of(2027,7,3)));
        when(tts.getWeek(eq(u),any())).thenReturn(TtsResponse.builder().answers(List.of(
                TtsResponse.AnswerResponse.builder().questionId(4L).answerData("{\"금\":true}").build())).build());
        assertFalse(eligibility.relevant(notice(Notification.NotificationType.TTS,"tts:2026-12-27:2027-01-02"),u,LocalDate.of(2027,1,2)));
        when(tts.getWeek(eq(u),any())).thenReturn(TtsResponse.builder().answers(List.of()).build());
        assertTrue(eligibility.relevant(notice(Notification.NotificationType.TTS,"tts:2026-12-27:2027-01-02"),u,LocalDate.of(2027,1,2)));
    }
}
