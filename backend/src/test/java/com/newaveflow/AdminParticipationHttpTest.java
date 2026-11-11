package com.newaveflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.dto.event.EventDto;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class AdminParticipationHttpTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired JwtTokenProvider tokens;
    @Autowired UserRepository users;
    @Autowired CommunityAgreementRepository agreements;
    @Autowired TtsQuestionRepository questions;
    @Autowired TtsService tts;
    @Autowired EventService events;
    @Autowired EventParticipantRepository participants;
    @Autowired ClassGroupRepository classes;
    @Autowired TeacherClassRepository assignments;
    @Autowired ReportService reports;
    @Autowired MeetingMinuteRepository minutes;

    User account(String name, User.Role role) {
        var user=users.saveAndFlush(User.builder().name(name).email(name+"@example.invalid").role(role).password("synthetic-only").build());
        agreements.saveAndFlush(new CommunityAgreement(user.getId(),CommunitySafetyService.POLICY_VERSION));
        return user;
    }
    String bearer(User u) {
        return "Bearer "+tokens.createAccessToken(u.getId(),u.getEmail(),u.getRole().name(),u.getAuthVersion());
    }
    void containsId(String route,User u) throws Exception {
        var response=http.perform(get(route).header("Authorization",bearer(u))).andExpect(status().isOk()).andReturn();
        var rows=json.readTree(response.getResponse().getContentAsString());
        boolean found=false;
        for(var row:rows) if(row.path("id").asLong()==u.getId())found=true;
        assertTrue(found,route+" must include participating administrators");
    }

    @Test void administratorCanUsePersonalChecksAndEveryManagementTier() throws Exception {
        var admin=account("participating-admin",User.Role.ADMIN);
        var teacher=account("participating-teacher",User.Role.TEACHER);
        var sunday=TtsService.weekSunday(LocalDate.now());
        var question=questions.saveAndFlush(TtsQuestion.builder().title("Synthetic personal check").type(TtsQuestion.TtsQuestionType.ATTEND).points(5).build());
        http.perform(put("/api/tts/answer").header("Authorization",bearer(admin)).contentType("application/json")
            .content(json.writeValueAsString(Map.of("weekStart",sunday,"questionId",question.getId(),"answerData","true")))).andExpect(status().isOk());
        var saturday=sunday.plusDays(6);
        http.perform(post("/api/meetings/attendance").header("Authorization",bearer(admin)).contentType("application/json")
            .content(json.writeValueAsString(Map.of("meetingDate",saturday,"status","ATTEND","reason","")))).andExpect(status().isOk());
        http.perform(post("/api/prayer-votes").header("Authorization",bearer(admin)).contentType("application/json")
            .content(json.writeValueAsString(Map.of("weekStart",PrayerVoteService.getWeekStart(LocalDate.now()),"status","TUE")))).andExpect(status().isOk());
        http.perform(get("/api/meetings/attendance/admin").param("date",saturday.toString()).header("Authorization",bearer(admin))).andExpect(status().isOk());
        http.perform(post("/api/tags").header("Authorization",bearer(admin)).contentType("application/json")
            .content("{\"name\":\"Synthetic pastor tool\",\"category\":\"EXECUTIVE\"}")).andExpect(status().isOk());
        http.perform(get("/api/admin/users/suspended").header("Authorization",bearer(admin))).andExpect(status().isOk());
        http.perform(put("/api/users/{id}/role",teacher.getId()).header("Authorization",bearer(admin))
            .contentType("application/json").content("{\"role\":\"ADMIN\"}")).andExpect(status().isOk());
        assertEquals(User.Role.ADMIN,users.findById(teacher.getId()).orElseThrow().getRole());
        var ordinary=account("ordinary-cannot-elevate",User.Role.TEACHER);
        http.perform(put("/api/users/{id}/role",ordinary.getId()).header("Authorization",bearer(ordinary))
            .contentType("application/json").content("{\"role\":\"ADMIN\"}")).andExpect(status().isForbidden());
    }

    @Test void administratorRemainsInPersonalStatisticsRostersAndConfirmationStatus() throws Exception {
        var admin=account("admin-cohort",User.Role.ADMIN);
        var group=classes.saveAndFlush(ClassGroup.builder().name("Synthetic class").ageGroup("중1").build());
        assignments.saveAndFlush(TeacherClass.builder().teacher(admin).classGroup(group).isPrimary(true).build());
        containsId("/api/users/teachers",admin);
        containsId("/api/users/teachers/roster",admin);
        containsId("/api/users",admin);
        var sunday=TtsService.weekSunday(LocalDate.now());
        var question=questions.saveAndFlush(TtsQuestion.builder().title("Synthetic counted check").type(TtsQuestion.TtsQuestionType.ATTEND).points(5).build());
        tts.saveAnswer(admin,new com.newaveflow.dto.tts.TtsAnswerRequest(sunday,question.getId(),"true"));
        @SuppressWarnings("unchecked") var people=(java.util.List<Map<String,Object>>)tts.getStats(sunday.getYear()).get("people");
        assertTrue(people.stream().anyMatch(p->admin.getId().equals(p.get("teacherId"))));
        assertEquals(1,reports.getSummary(sunday).totalTeachers());
        var minute=minutes.saveAndFlush(MeetingMinute.builder().title("Synthetic confirmed meeting").content("Synthetic text").meetingDate(sunday.plusDays(6)).isActive(true).build());
        http.perform(post("/api/minutes/{id}/confirm",minute.getId()).header("Authorization",bearer(admin))).andExpect(status().isNoContent());
        var result=http.perform(get("/api/minutes/{id}/status",minute.getId()).header("Authorization",bearer(admin))).andExpect(status().isOk()).andReturn();
        var rows=json.readTree(result.getResponse().getContentAsString());
        assertEquals(admin.getId().longValue(),rows.get(0).path("teacherId").asLong());
        assertTrue(rows.get(0).path("confirmed").asBoolean());
    }

    @Test void administratorAttendanceIsCountedForNewAndPreexistingEventSnapshots() {
        var admin=account("admin-event-participant",User.Role.ADMIN);
        var today=EventAttendanceWindow.today();
        var event=events.createEvent(new EventDto.EventCreateRequest("Synthetic event",null,today.plusDays(1),today.plusDays(2),null,null,null,"SPECIAL",true,today.plusDays(1),"TEACHER_ONLY",today));
        assertTrue(participants.findByEventIdAndKindAndPersonId(event.id(),"TEACHER",admin.getId()).isPresent());
        // Emulate an old event snapshot created before administrators were included.
        var lateAdmin=account("legacy-event-admin",User.Role.ADMIN);
        for(int i=0;i<2;i++)events.saveTeacherAttendance(event.id(),lateAdmin.getId(),"PRESENT",null,null,null);
        assertEquals(2,participants.findByEventIdAndKindOrderByName(event.id(),"TEACHER").size());
        assertTrue(events.getTeacherAttendanceSummary(event.id()).stream().anyMatch(r->r.teacherId().equals(lateAdmin.getId())&&"PRESENT".equals(r.status())));
        var unregistered=account("unregistered-teacher",User.Role.TEACHER);
        assertThrows(com.newaveflow.exception.AppException.class,()->events.saveTeacherAttendance(event.id(),unregistered.getId(),"PRESENT",null,null,null));
    }
}
