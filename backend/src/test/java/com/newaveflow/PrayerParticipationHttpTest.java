package com.newaveflow;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class PrayerParticipationHttpTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired JwtTokenProvider tokens;
    @Autowired UserRepository users;
    @Autowired PrayerVoteRepository votes;
    @Autowired CommunityAgreementRepository agreements;
    @Autowired ClassGroupRepository classes;
    @Autowired TeacherClassRepository assignments;
    @Autowired JdbcTemplate sql;
    @Autowired EntityManager em;
    private final LocalDate week = PrayerVoteService.getWeekStart(LocalDate.now(ZoneId.of("Asia/Seoul")));

    User account(String name, User.Role role, boolean active) {
        var user = users.saveAndFlush(User.builder().name(name).email(name + "@example.invalid")
                .password("synthetic-only").role(role).grade("중1").isActive(active).build());
        agreements.saveAndFlush(new CommunityAgreement(user.getId(), CommunitySafetyService.POLICY_VERSION));
        sql.update("UPDATE users SET created_at=? WHERE id=?", java.sql.Timestamp.valueOf(week.minusWeeks(20).atStartOfDay()), user.getId());
        em.clear();
        return users.findById(user.getId()).orElseThrow();
    }
    String token(User user) { return "Bearer " + tokens.createAccessToken(user.getId(), user.getEmail(), user.getRole().name(), user.getAuthVersion()); }
    PrayerVote vote(User user, LocalDate date, PrayerVote.Status status) {
        return votes.saveAndFlush(PrayerVote.builder().teacher(user).weekStart(date).status(status).reason("가상 사유").build());
    }
    JsonNode getWeek(User user, LocalDate date) throws Exception {
        var result = http.perform(get("/api/prayer-votes/participation").param("week", date.toString())
                .header("Authorization", token(user))).andExpect(status().isOk()).andReturn();
        return json.readTree(result.getResponse().getContentAsString());
    }
    JsonNode person(JsonNode body, Long id) {
        for (JsonNode row : body.path("people")) if (row.path("teacherId").asLong() == id) return row;
        return null;
    }

    @Test void countsBothAttendanceDaysWithoutTreatingMissingVotesAsAbsences() throws Exception {
        var admin = account("prayer-admin", User.Role.ADMIN, true);
        var tue = account("prayer-tue", User.Role.TEACHER, true);
        var thu = account("prayer-thu", User.Role.EXECUTIVE, true);
        var absent = account("prayer-absent", User.Role.TEACHER, true);
        var unknown = account("prayer-unknown", User.Role.TEACHER, true);
        var pending = account("prayer-pending", User.Role.TEACHER, false);
        var suspended = account("prayer-suspended", User.Role.TEACHER, true);
        suspended.suspend(); users.saveAndFlush(suspended);
        vote(tue, week, PrayerVote.Status.TUE); vote(thu, week, PrayerVote.Status.THU); vote(absent, week, PrayerVote.Status.ABSENT);
        var body = getWeek(admin, week);
        assertEquals(1, body.at("/summary/tuesday").asInt());
        assertEquals(1, body.at("/summary/thursday").asInt());
        assertEquals(1, body.at("/summary/absent").asInt());
        assertEquals(2, body.at("/summary/unanswered").asInt());
        assertEquals("UNKNOWN", person(body, unknown.getId()).path("status").asText());
        assertNotNull(person(body, admin.getId()));
        assertNull(person(body, pending.getId())); assertNull(person(body, suspended.getId()));
        assertEquals(8, body.path("trend").size());
        assertFalse(body.toString().contains("@example.invalid"));
        assertFalse(body.toString().contains("scriptureCopy"));
        http.perform(post("/api/prayer-votes").header("Authorization", token(tue)).contentType("application/json")
                .content(json.writeValueAsString(java.util.Map.of("weekStart", week, "status", "ABSENT", "reason", "변경된 가상 사유"))))
                .andExpect(status().isOk());
        var changed = getWeek(admin, week);
        assertEquals(0, changed.at("/summary/tuesday").asInt());
        assertEquals(2, changed.at("/summary/absent").asInt());
        assertEquals(2, changed.at("/summary/unanswered").asInt());
        assertEquals("변경된 가상 사유", person(changed, tue.getId()).path("reason").asText());
        assertEquals(changed.path("summary"), changed.at("/trend/7"));
    }

    @Test void preservesHistoricalResponsesWithoutInventingPastUnansweredForNewAccounts() throws Exception {
        var admin = account("history-admin", User.Role.ADMIN, true);
        var old = account("history-inactive", User.Role.TEACHER, false);
        var newcomer = account("history-new", User.Role.TEACHER, true);
        sql.update("UPDATE users SET created_at=? WHERE id=?", java.sql.Timestamp.valueOf(week.atStartOfDay()), newcomer.getId()); em.clear();
        vote(old, week.minusWeeks(1), PrayerVote.Status.THU);
        vote(admin, week.minusWeeks(8), PrayerVote.Status.ABSENT);
        var body = getWeek(admin, week.minusWeeks(1));
        assertEquals(1, body.at("/summary/thursday").asInt());
        assertEquals(1, body.at("/summary/unanswered").asInt());
        assertNotNull(person(body, old.getId())); assertNull(person(body, newcomer.getId()));
        assertEquals(week.minusWeeks(8).toString(), body.at("/trend/0/weekStart").asText());
        var empty = getWeek(admin, week.minusWeeks(2));
        assertEquals(0, empty.at("/summary/tuesday").asInt());
        assertEquals(0, empty.at("/summary/thursday").asInt());
        assertEquals(0, empty.at("/summary/absent").asInt());
    }

    @Test void multipleClassAssignmentsCannotDuplicateOneTeachersVote() throws Exception {
        var admin = account("multi-admin", User.Role.ADMIN, true);
        var teacher = account("multi-teacher", User.Role.TEACHER, true);
        sql.update("UPDATE users SET grade=null WHERE id=?", teacher.getId());
        for (int i = 0; i < 2; i++) {
            var group = classes.saveAndFlush(ClassGroup.builder().name("가상반" + i).ageGroup("고2").build());
            assignments.saveAndFlush(TeacherClass.builder().teacher(teacher).classGroup(group).isPrimary(i == 0).build());
        }
        vote(teacher, week, PrayerVote.Status.TUE); em.clear();
        var body = getWeek(admin, week);
        assertEquals(1, body.at("/summary/tuesday").asInt());
        assertEquals(2, body.path("people").size());
        assertEquals("고2", person(body, teacher.getId()).path("teacherGrade").asText());
    }

    @Test void statisticsRequireManagementRoleAndRejectFutureWeeks() throws Exception {
        for (var role : new User.Role[]{User.Role.ADMIN, User.Role.PASTOR, User.Role.EXECUTIVE}) {
            var user = account("role-" + role, role, true);
            assertEquals(week.toString(), getWeek(user, week.plusDays(2)).path("weekStart").asText());
            http.perform(get("/api/prayer-votes/participation").param("week", week.plusWeeks(1).toString())
                    .header("Authorization", token(user))).andExpect(status().isBadRequest());
        }
        var teacher = account("ordinary-prayer", User.Role.TEACHER, true);
        http.perform(get("/api/prayer-votes/participation").param("week", week.toString())
                .header("Authorization", token(teacher))).andExpect(status().isForbidden());
        http.perform(get("/api/prayer-votes/participation").param("week", week.toString())).andExpect(status().isUnauthorized());
    }

    @Test void retiredScriptureEndpointDoesNotModifyHistoricalRecords() throws Exception {
        var admin = account("retired-admin", User.Role.ADMIN, true);
        var teacher = account("retired-teacher", User.Role.TEACHER, true);
        var vote = vote(teacher, week, PrayerVote.Status.ABSENT);
        vote.markScriptureSubmitted(); votes.saveAndFlush(vote);
        var confirmedAt = vote.getScriptureCopySubmittedAt();
        http.perform(patch("/api/prayer-votes/{id}/scripture", vote.getId()).header("Authorization", token(admin))
                .contentType("application/json").content("{\"submitted\":false}")).andExpect(status().isGone());
        var saved = votes.findById(vote.getId()).orElseThrow();
        assertTrue(saved.isScriptureCopySubmitted()); assertEquals(confirmedAt, saved.getScriptureCopySubmittedAt());
        assertEquals("ABSENT", person(getWeek(admin, week), teacher.getId()).path("status").asText());
    }
}
