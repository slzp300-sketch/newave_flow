package com.newaveflow;

import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import java.time.LocalDate;
import java.util.List;
import java.util.function.Consumer;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(showSql = false) @ActiveProfiles("test") @Import(EventReadService.class)
class EventReadTest {
    @Autowired EventReadService service;
    @Autowired EventReadRepository reads;
    @Autowired EventRepository events;
    @Autowired UserRepository users;
    @Autowired EntityManager em;
    User account(String name) { return users.saveAndFlush(User.builder().name(name).email(name+"@example.invalid")
            .password("synthetic").role(User.Role.TEACHER).build()); }
    Event event() { return events.saveAndFlush(Event.builder().title("검수 일정").description("첫 안내")
            .eventDate(LocalDate.of(2026,10,17)).eventType(Event.EventType.SPECIAL).build()); }

    @Test void separateSessionsShareOnlyTheirAccountAndRepeatedReadsAreIdempotent() {
        var a=account("a"); var b=account("b"); var event=event(); var second=event();
        var version=EventReadVersion.of(event);
        service.acknowledge(a.getId(),event.getId(),version);
        em.flush(); em.clear();
        assertEquals(version,service.getReads(a.getId()).get(event.getId()));
        assertTrue(service.getReads(b.getId()).isEmpty());
        service.acknowledge(a.getId(),event.getId(),version);
        service.acknowledge(a.getId(),second.getId(),EventReadVersion.of(second));
        service.acknowledge(b.getId(),event.getId(),version);
        em.flush(); em.clear();
        assertEquals(3,reads.count());
        assertEquals(2,service.getReads(a.getId()).size());
        assertEquals(1,service.getReads(b.getId()).size());
    }

    @Test void staleDeviceCannotAcknowledgeEditedContentOrReplaceNewerRead() {
        var a=account("a"); var event=event(); var original=EventReadVersion.of(event);
        service.acknowledge(a.getId(),event.getId(),original);
        event.setDescription("변경된 안내"); em.flush();
        var current=EventReadVersion.of(event);
        assertNotEquals(original,current);
        service.acknowledge(a.getId(),event.getId(),current);
        assertThrows(AppException.class,()->service.acknowledge(a.getId(),event.getId(),original));
        assertEquals(current,service.getReads(a.getId()).get(event.getId()));
        assertThrows(AppException.class,()->service.acknowledge(a.getId(),999999L,current));
    }

    @Test void deletingScheduleCascadesOnlyItsReadRecords() {
        var a=account("a"); var first=event(); var second=event();
        service.acknowledge(a.getId(),first.getId(),EventReadVersion.of(first));
        service.acknowledge(a.getId(),second.getId(),EventReadVersion.of(second));
        em.flush(); em.clear();
        events.deleteById(first.getId()); em.flush(); em.clear();
        assertEquals(1,reads.count());
        assertTrue(service.getReads(a.getId()).containsKey(second.getId()));
        users.deleteById(a.getId()); em.flush(); em.clear();
        assertEquals(0,reads.count());
    }

    @Test void everyDisplayedFieldChangesVersionButInternalRosterDoesNot() {
        List<Consumer<Event>> changes=List.of(e->e.setTitle("새 제목"),e->e.setDescription("새 설명"),
                e->e.setEventDate(LocalDate.of(2026,10,18)),e->e.setEndDate(LocalDate.of(2026,10,19)),
                e->e.setStartTime("10:00"),e->e.setEndTime("11:00"),e->e.setColor("blue"),
                e->e.setEventType(Event.EventType.MEETING),e->e.setAttendanceRequired(true),
                e->e.setAttendanceDeadline(LocalDate.of(2026,10,16)),e->e.setAttendanceTarget(Event.AttendanceTarget.BOTH),
                e->e.setAttendanceStartDate(LocalDate.of(2026,10,12)));
        for(var change:changes) {
            var event=event(); var version=EventReadVersion.of(event); change.accept(event);
            assertNotEquals(version,EventReadVersion.of(event));
        }
        var event=event(); var version=EventReadVersion.of(event);
        event.setRosterCapturedAt(java.time.LocalDateTime.now()); event.setAttendanceTarget(null);
        assertEquals(version,EventReadVersion.of(event));
        assertTrue(version.matches("[a-f0-9]{64}"));
    }
}
