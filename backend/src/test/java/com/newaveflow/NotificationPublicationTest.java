package com.newaveflow;
import com.newaveflow.controller.MeetingMinuteController;
import com.newaveflow.dto.meeting.MeetingMinuteCreateRequest;
import com.newaveflow.dto.event.EventDto;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import org.junit.jupiter.api.*;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class NotificationPublicationTest {
    User teacher(long id) { return User.builder().id(id).name("Synthetic").email("synthetic"+id+"@example.invalid").role(User.Role.TEACHER).build(); }
    @Test void minutesNotifyOnlyAbsentAtFirstPublicationIncludingDraftToPublic() {
        var repo=mock(MeetingMinuteRepository.class);var attendance=mock(MeetingAttendanceRepository.class);var notices=mock(NotificationService.class);
        var controller=new MeetingMinuteController(repo,mock(MeetingMinuteConfirmRepository.class),attendance,mock(UserRepository.class),notices);
        var date=LocalDate.of(2026,10,17);
        when(repo.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var saved=controller.create(new MeetingMinuteCreateRequest("Synthetic","Synthetic",null,date,false)).getBody();
        assertNotNull(saved);saved.setId(7L);when(repo.lockById(7L)).thenReturn(Optional.of(saved));
        when(attendance.findByMeetingDate(date)).thenReturn(List.of(MeetingAttendance.builder().teacher(teacher(1)).status("ATTEND").build(),
                MeetingAttendance.builder().teacher(teacher(2)).status("ABSENT").build()));
        verifyNoInteractions(notices);
        controller.update(7L,new MeetingMinuteCreateRequest("Synthetic","Synthetic",null,date,true));
        controller.update(7L,new MeetingMinuteCreateRequest("Edited","Synthetic",null,date,true));
        controller.update(7L,new MeetingMinuteCreateRequest("Edited","Synthetic",null,date,false));
        controller.update(7L,new MeetingMinuteCreateRequest("Edited","Synthetic",null,date,true));
        verify(notices).enqueue(eq(2L),eq("minute-published:7"),anyString(),anyString(),eq(Notification.NotificationType.MINUTE),eq("/minutes"));
        verifyNoMoreInteractions(notices);
        verify(repo,times(4)).lockById(7L);
    }
    @Test void singleAndBulkNewEventsUseTheSameRecipientAndIdentityRule() {
        var repo=mock(EventRepository.class);var users=mock(UserRepository.class);var notices=mock(NotificationService.class);
        var service=new EventService(repo,mock(EventAttendanceRepository.class),mock(EventStudentAttendanceRepository.class),users,
                mock(TeacherClassRepository.class),mock(StudentRepository.class),notices,mock(EventRosterService.class),mock(EventParticipantRepository.class));
        when(users.findByIsActiveTrue()).thenReturn(List.of(teacher(1)));
        when(repo.save(any())).thenAnswer(i -> {Event e=i.getArgument(0);e.setId(1L);return e;});
        when(repo.saveAll(any())).thenAnswer(i -> {List<Event> list=i.getArgument(0);for(int n=0;n<list.size();n++)list.get(n).setId((long)n+2);return list;});
        var req=new EventDto.EventCreateRequest("Synthetic",null,LocalDate.of(2026,10,20),null,null,null,null,"SPECIAL",false,null,null,null);
        service.createEvent(req);service.createEvents(List.of(req,req));
        for(long id=1;id<=3;id++)verify(notices).enqueue(eq(1L),eq("event-new:"+id),anyString(),anyString(),eq(Notification.NotificationType.EVENT),eq("/calendar"));
        verifyNoMoreInteractions(notices);
    }
}
