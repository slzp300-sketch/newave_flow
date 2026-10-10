package com.newaveflow;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.test.context.ActiveProfiles;
import java.time.LocalDate;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(showSql = false) @ActiveProfiles("test")
@Import({OperationService.class, EvangelismService.class, StorageRegressionTest.JsonConfig.class})
class StorageRegressionTest {
    @TestConfiguration static class JsonConfig { @Bean ObjectMapper mapper() { return new ObjectMapper().findAndRegisterModules(); } }
    @Autowired OperationService operations;
    @Autowired UserRepository users;
    @Autowired EvangelismGroupRepository groups;
    @Autowired EvangelismGroupMemberRepository members;
    @Autowired EvangelismService evangelism;

    User account() { return users.saveAndFlush(User.builder().name("검증 교사").email("storage@example.invalid").password("synthetic").role(User.Role.TEACHER).build()); }

    @Test void repeatedOperationReturnsOriginalResultAndDifferentPayloadIsRejected() {
        var actor = account(); var calls = new AtomicInteger(); var type = new TypeReference<Map<String,Integer>>() {};
        var first = operations.execute(actor.getId(), "synthetic-operation-1", "advance", Map.of("a","b"), type, () -> Map.of("advanced", calls.incrementAndGet()));
        var replay = operations.execute(actor.getId(), "synthetic-operation-1", "advance", Map.of("a","b"), type, () -> Map.of("advanced", calls.incrementAndGet()));
        assertEquals(first, replay); assertEquals(1,calls.get());
        assertThrows(AppException.class, () -> operations.execute(actor.getId(), "synthetic-operation-1", "advance", Map.of("a","c"), type, () -> Map.of("advanced",99)));
    }

    @Test void moveChangesOneMembershipAndStaleSourceIsRejected() {
        var teacher = account(); var a = groups.saveAndFlush(EvangelismGroup.builder().name("검증 A").build());
        var b = groups.saveAndFlush(EvangelismGroup.builder().name("검증 B").build());
        members.saveAndFlush(EvangelismGroupMember.builder().teacher(teacher).group(a).build());
        evangelism.moveTeacher(teacher.getId(),a.getId(),b.getId()); members.flush();
        var result = members.findActiveByTeacherId(teacher.getId());
        assertEquals(1,result.size()); assertEquals(b.getId(),result.get(0).getGroup().getId());
        assertThrows(AppException.class, () -> evangelism.moveTeacher(teacher.getId(),a.getId(),null));
    }

    @Test void removedGroupDoesNotRemainInPersonalMembership() {
        var teacher = account(); var group = groups.saveAndFlush(EvangelismGroup.builder().name("검증 조").build());
        members.saveAndFlush(EvangelismGroupMember.builder().teacher(teacher).group(group).build());
        evangelism.deleteGroup(group.getId());
        assertTrue(members.findActiveByTeacherId(teacher.getId()).isEmpty());
        assertNull(evangelism.getMyStatus(teacher.getId()).myGroup());
    }

    @Test void validatesDatesAndAttendanceSemantics() {
        LocalDate day = LocalDate.of(2026,1,4);
        assertThrows(AppException.class, () -> InputRules.eventDates("검증",day,day.minusDays(1)));
        var event = Event.builder().eventDate(day).endDate(day.plusDays(2)).build();
        assertThrows(AppException.class, () -> InputRules.eventAttendance(event,"UNKNOWN",null,null));
        assertThrows(AppException.class, () -> InputRules.eventAttendance(event,"ABSENT","",null));
        assertThrows(AppException.class, () -> InputRules.eventAttendance(event,"PARTIAL",null,day.plusDays(3)));
        assertDoesNotThrow(() -> InputRules.eventAttendance(event,"PARTIAL",null,day.plusDays(1)));
    }
}
