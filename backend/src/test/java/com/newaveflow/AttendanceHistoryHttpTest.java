package com.newaveflow;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.CommunitySafetyService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class AttendanceHistoryHttpTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired StudentRepository students;
    @Autowired ClassGroupRepository classes;
    @Autowired AttendanceRepository attendance;
    @Autowired CommunityAgreementRepository agreements;
    @Autowired JwtTokenProvider tokens;
    Student student;
    ClassGroup group;
    String authorization;
    LocalDate latest = LocalDate.of(2026, 11, 8);

    @BeforeEach void setup() {
        var teacher = users.saveAndFlush(User.builder().name("가상 이력교사").email(UUID.randomUUID()+"@example.invalid").role(User.Role.TEACHER).build());
        agreements.saveAndFlush(new CommunityAgreement(teacher.getId(), CommunitySafetyService.POLICY_VERSION));
        authorization = "Bearer " + tokens.createAccessToken(teacher.getId(), teacher.getEmail(), teacher.getRole().name(), teacher.getAuthVersion());
        group = classes.saveAndFlush(ClassGroup.builder().name("가상 이력반").ageGroup("중1").build());
        student = students.saveAndFlush(Student.builder().name("가상 이력학생").grade("중1").classGroup(group).build());
    }
    String url() { return "/api/attendance/student/"+student.getId()+"/history"; }
    void row(Student person, LocalDate date) {
        attendance.saveAndFlush(Attendance.builder().student(person).classGroup(group).attendanceDate(date).status(Attendance.Status.PRESENT).build());
    }
    JsonNode page(String before, int size) throws Exception {
        var request = get(url()).header("Authorization", authorization).param("size", String.valueOf(size));
        if (before != null) request.param("before", before);
        return json.readTree(http.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
    @Test void boundedPagesRemainNewestFirstAndDoNotDuplicateAfterNewRecordsArrive() throws Exception {
        for (int i=0;i<43;i++) row(student, latest.minusWeeks(i));
        var other = students.saveAndFlush(Student.builder().name("가상 다른학생").grade("중1").classGroup(group).build());
        row(other, latest);
        var first = page(null,20);
        assertEquals(20, first.get("items").size());
        assertEquals(latest.toString(), first.at("/items/0/attendanceDate").asText());
        assertTrue(first.get("hasMore").asBoolean());
        // An inserted recent record must not shift the older-page boundary.
        row(student,latest.plusWeeks(1));
        var second = page(first.get("nextBefore").asText(),20);
        var last = page(second.get("nextBefore").asText(),20);
        assertEquals(20,second.get("items").size()); assertEquals(3,last.get("items").size());
        assertFalse(last.get("hasMore").asBoolean()); assertTrue(last.get("nextBefore").isNull());
        Set<String> dates = new HashSet<>();
        for (var batch : List.of(first,second,last)) for (var item : batch.get("items")) {
            assertEquals(student.getId().longValue(),item.get("studentId").asLong());
            assertTrue(dates.add(item.get("attendanceDate").asText()));
        }
        assertEquals(43,dates.size());
        var oldResponse=json.readTree(http.perform(get("/api/attendance/student/"+student.getId()).header("Authorization",authorization)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertTrue(oldResponse.isArray()); assertEquals(44,oldResponse.size());
    }
    @Test void emptyExactPageAndEndCursorAreUnambiguous() throws Exception {
        var empty=page(null,20);
        assertEquals(0,empty.get("items").size()); assertFalse(empty.get("hasMore").asBoolean());
        for(int i=0;i<20;i++)row(student,latest.minusWeeks(i));
        var exact=page(null,20);
        assertEquals(20,exact.get("items").size()); assertFalse(exact.get("hasMore").asBoolean());
        assertEquals(0,page(latest.minusWeeks(19).toString(),20).get("items").size());
    }
    @Test void authenticationInvalidLimitsAndMissingStudentsAreRejected() throws Exception {
        http.perform(get(url())).andExpect(status().isUnauthorized());
        for (int size : List.of(0,-1,51,100000)) http.perform(get(url()).header("Authorization",authorization).param("size",String.valueOf(size))).andExpect(status().isBadRequest());
        http.perform(get(url()).header("Authorization",authorization).param("before","not-a-date")).andExpect(status().isBadRequest());
        http.perform(get("/api/attendance/student/9223372036854775807/history").header("Authorization",authorization)).andExpect(status().isNotFound());
    }
}
