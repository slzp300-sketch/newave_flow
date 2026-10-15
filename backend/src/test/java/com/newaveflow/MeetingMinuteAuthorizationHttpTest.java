package com.newaveflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.CommunitySafetyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class MeetingMinuteAuthorizationHttpTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired MeetingMinuteRepository minutes;
    @Autowired MeetingMinuteConfirmRepository confirmations;
    @Autowired MeetingAttendanceRepository attendance;
    @Autowired CommunityAgreementRepository agreements;
    @Autowired JwtTokenProvider tokens;
    private User teacher, other;
    private MeetingMinute published, hidden;

    @BeforeEach void setup() {
        teacher = account("minute-reader", User.Role.TEACHER);
        other = account("minute-other", User.Role.TEACHER);
        published = minute("Synthetic published minute", true);
        hidden = minute("Synthetic hidden minute", false);
        attendance.saveAndFlush(MeetingAttendance.builder().teacher(other)
            .meetingDate(published.getMeetingDate()).status("ABSENT").reason("Synthetic private absence reason").build());
    }

    private User account(String name, User.Role role) {
        var user = users.saveAndFlush(User.builder().name(name).email(name + "@example.invalid")
            .password("synthetic-only").role(role).build());
        agreements.saveAndFlush(new CommunityAgreement(user.getId(), CommunitySafetyService.POLICY_VERSION));
        return user;
    }

    private MeetingMinute minute(String title, boolean active) {
        return minutes.saveAndFlush(MeetingMinute.builder().title(title).content("Synthetic meeting content")
            .meetingDate(LocalDate.of(2026, 10, 10)).isActive(active).build());
    }

    private String token(User user) {
        return "Bearer " + tokens.createAccessToken(user.getId(), user.getEmail(), user.getRole().name(), user.getAuthVersion());
    }

    @Test void unauthenticatedRequestsCannotReadOrConfirmMinutes() throws Exception {
        http.perform(get("/api/minutes")).andExpect(status().isUnauthorized());
        http.perform(get("/api/minutes/{id}/status", published.getId())).andExpect(status().isUnauthorized());
        http.perform(post("/api/minutes/{id}/confirm", published.getId())).andExpect(status().isUnauthorized());
    }

    @Test void teacherReadsPublishedContentAndConfirmsOnlyTheirOwnAccountIdempotently() throws Exception {
        confirmations.saveAndFlush(MeetingMinuteConfirm.builder().minutes(published).user(other).build());
        var first = http.perform(get("/api/minutes").header("Authorization", token(teacher)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].id").value(published.getId()))
            .andExpect(jsonPath("$[0].content").value("Synthetic meeting content"))
            .andExpect(jsonPath("$[0].confirmed").value(false))
            .andReturn().getResponse().getContentAsString();
        assertFalse(first.contains("Synthetic private absence reason"));
        for (int i = 0; i < 2; i++) {
            http.perform(post("/api/minutes/{id}/confirm", published.getId())
                .param("userId", other.getId().toString()).header("Authorization", token(teacher)))
                .andExpect(status().isNoContent());
        }
        assertTrue(confirmations.findByMinutesAndUser(published, teacher).isPresent());
        assertEquals(2, confirmations.findAllByMinutes(published).size());
        http.perform(get("/api/minutes").header("Authorization", token(teacher)))
            .andExpect(jsonPath("$[0].confirmed").value(true));
    }

    @Test void teacherCannotReadManagementStatusEvenForPublishedOrUnknownIds() throws Exception {
        for (long id : new long[]{published.getId(), hidden.getId(), Long.MAX_VALUE}) {
            http.perform(get("/api/minutes/{id}/status", id).header("Authorization", token(teacher)))
                .andExpect(status().isForbidden());
        }
    }

    @Test void teacherCannotConfirmHiddenMissingOrNewlyHiddenContent() throws Exception {
        for (long id : new long[]{hidden.getId(), Long.MAX_VALUE}) {
            http.perform(post("/api/minutes/{id}/confirm", id).header("Authorization", token(teacher)))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.message").value("회의록을 찾을 수 없습니다."));
        }
        assertTrue(confirmations.findAllByMinutes(hidden).isEmpty());
        published.setActive(false);
        minutes.saveAndFlush(published);
        http.perform(post("/api/minutes/{id}/confirm", published.getId()).header("Authorization", token(teacher)))
            .andExpect(status().isNotFound());
        assertTrue(confirmations.findAllByMinutes(published).isEmpty());
        http.perform(get("/api/minutes").header("Authorization", token(teacher)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    @ParameterizedTest
    @EnumSource(value = User.Role.class, names = {"ADMIN", "PASTOR", "EXECUTIVE"})
    void managementRolesRetainPrivateMinuteAndAttendanceManagement(User.Role role) throws Exception {
        var manager = account("minute-manager-" + role.name().toLowerCase(), role);
        var listed = json.readTree(http.perform(get("/api/minutes").header("Authorization", token(manager)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
            .andReturn().getResponse().getContentAsString());
        assertTrue(listed.findValues("id").stream().anyMatch(value -> value.asLong() == hidden.getId()));
        var result = json.readTree(http.perform(get("/api/minutes/{id}/status", hidden.getId())
            .header("Authorization", token(manager))).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        var otherStatus = result.findValues("teacherId").stream().filter(value -> value.asLong() == other.getId()).findFirst();
        assertTrue(otherStatus.isPresent());
        assertTrue(result.findValues("attendanceReason").stream()
            .anyMatch(value -> value.asText().equals("Synthetic private absence reason")));
        http.perform(post("/api/minutes/{id}/confirm", hidden.getId()).header("Authorization", token(manager)))
            .andExpect(status().isNoContent());
        http.perform(get("/api/minutes/{id}/status", Long.MAX_VALUE).header("Authorization", token(manager)))
            .andExpect(status().isNotFound());
    }
}
