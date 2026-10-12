package com.newaveflow;

import com.newaveflow.dto.event.EventDto;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import java.time.LocalDate;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(showSql=false) @ActiveProfiles("test") @Import({EventService.class,EventRosterService.class})
class EventAttendanceWindowTest {
    @Autowired EventService service;
    @Autowired EventRepository events;
    @Autowired UserRepository users;
    @Autowired ClassGroupRepository classes;
    @Autowired StudentRepository students;
    @Autowired TeacherClassRepository assignments;
    @Autowired EventAttendanceRepository teacherRecords;
    @Autowired EventStudentAttendanceRepository studentRecords;
    @MockBean NotificationService notifications;
    final LocalDate today=EventAttendanceWindow.today();
    EventDto.EventCreateRequest request(String target,LocalDate start,LocalDate deadline,boolean enabled) {
        return new EventDto.EventCreateRequest("가상 행사",null,today.plusDays(7),today.plusDays(8),null,null,null,"SPECIAL",enabled,deadline,target,start);
    }
    User teacher(String name) { return users.saveAndFlush(User.builder().name(name).email(name+"@example.invalid").password("synthetic").role(User.Role.TEACHER).build()); }
    Student assign(User teacher) {
        var group=classes.saveAndFlush(ClassGroup.builder().name("가상 반").ageGroup("중1").build());
        assignments.saveAndFlush(TeacherClass.builder().teacher(teacher).classGroup(group).isPrimary(true).build());
        return students.saveAndFlush(Student.builder().name("가상 학생").grade("중1").classGroup(group).build());
    }
    void student(Long event,User teacher,Student student) {
        service.saveStudentAttendanceBatch(event,teacher.getId(),List.of(new EventDto.StudentAttendanceItem(student.getId(),"PRESENT",null,null,null)));
    }
    void teacher(Long event,User teacher) { service.saveTeacherAttendance(event,teacher.getId(),"PRESENT",null,null,null); }

    @Test void targetControlsBothWritePathsAndNoTeacherCanSubmitAnotherClass() {
        var teacher=teacher("owner"); var student=assign(teacher); var other=teacher("other");
        for(var target:List.of("TEACHER_ONLY","STUDENT_ONLY","BOTH")) {
            var event=service.createEvent(request(target,today,today,true));
            if(target.equals("STUDENT_ONLY")) assertThrows(AppException.class,()->teacher(event.id(),teacher));
            else teacher(event.id(),teacher);
            if(target.equals("TEACHER_ONLY")) assertThrows(AppException.class,()->student(event.id(),teacher,student));
            else student(event.id(),teacher,student);
            assertThrows(AppException.class,()->student(event.id(),other,student));
        }
        assertEquals(2,teacherRecords.count()); assertEquals(2,studentRecords.count());
    }

    @Test void beforeStartAfterDeadlineAndDisabledRejectBothWritesButKeepExistingRecords() {
        var teacher=teacher("owner"); var student=assign(teacher);
        var event=service.createEvent(request("BOTH",today,today,true));
        teacher(event.id(),teacher); student(event.id(),teacher,student);
        for(var request:List.of(request("BOTH",today.plusDays(1),today.plusDays(2),true),
                request("BOTH",today.minusDays(2),today.minusDays(1),true),request("BOTH",null,null,false))) {
            service.updateEvent(event.id(),request);
            assertThrows(AppException.class,()->teacher(event.id(),teacher));
            assertThrows(AppException.class,()->student(event.id(),teacher,student));
            assertEquals("PRESENT",service.getMyTeacherAttendance(event.id(),teacher.getId()).status());
            assertEquals("PRESENT",service.getMyClassAttendance(event.id(),teacher.getId()).get(0).status());
        }
        assertEquals(1,teacherRecords.count()); assertEquals(1,studentRecords.count());
    }

    @Test void invalidRangeRejectsCreateBulkAndEditWithoutPartialChanges() {
        var valid=request("BOTH",today,today,true);
        var invalid=request("BOTH",today.plusDays(1),today,true);
        assertThrows(AppException.class,()->service.createEvents(List.of(valid,invalid)));
        assertEquals(0,events.count());
        var created=service.createEvent(valid);
        assertThrows(AppException.class,()->service.updateEvent(created.id(),invalid));
        var after=service.getEvent(created.id());
        assertEquals(today,after.attendanceStartDate()); assertEquals(today,after.attendanceDeadline());
    }

    @Test void legacyDatesUseEventEndAndInclusiveKoreanDayBoundaries() {
        var event=Event.builder().title("가상 기존 행사").eventDate(today.minusDays(2)).endDate(today)
                .eventType(Event.EventType.SPECIAL).attendanceRequired(true).build();
        assertDoesNotThrow(()->EventAttendanceWindow.assertOpen(event,today));
        assertThrows(AppException.class,()->EventAttendanceWindow.assertOpen(event,today.plusDays(1)));
        event.setAttendanceStartDate(today);
        assertThrows(AppException.class,()->EventAttendanceWindow.assertOpen(event,today.minusDays(1)));
        event.setAttendanceDeadline(today.plusDays(1));
        assertDoesNotThrow(()->EventAttendanceWindow.assertOpen(event,today.plusDays(1)));
    }
}
