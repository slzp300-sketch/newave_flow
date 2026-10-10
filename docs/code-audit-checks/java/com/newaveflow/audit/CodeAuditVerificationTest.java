package com.newaveflow.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.config.SecurityConfig;
import com.newaveflow.controller.StudentController;
import com.newaveflow.dto.attendance.AttendanceBatchRequest;
import com.newaveflow.dto.auth.ResetPasswordRequest;
import com.newaveflow.dto.tts.TtsSubmitRequest;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtAuthenticationFilter;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Audit characterization checks: passing confirms the reported current behavior, not that it is safe.
 * No Spring Boot application, database, live account, network request, or roster fixture is used. */
class CodeAuditVerificationTest {
    private static final String SYNTHETIC_KEY = "audit-only-synthetic-signing-key-not-used-by-the-app";
    private JwtTokenProvider tokens() { return new JwtTokenProvider(SYNTHETIC_KEY, 3600000, 604800000); }
    private User teacher() { return User.builder().id(901L).name("Audit Teacher").email("audit@example.invalid")
            .role(User.Role.TEACHER).isActive(true).build(); }

    @Test void resetReturnsUsablePasswordFromIdentityFieldsAlone() {
        var users = mock(UserRepository.class);
        var encoder = new BCryptPasswordEncoder(4);
        var account = teacher();
        when(users.findByEmailIgnoreCaseAndNameAndPhone("audit@example.invalid", "Audit Teacher", "01000000000"))
                .thenReturn(Optional.of(account));
        var service = new AuthService(users, encoder, tokens());
        var response = service.resetPassword(new ResetPasswordRequest("audit@example.invalid", "Audit Teacher", "01000000000"));
        assertTrue(encoder.matches(response.tempPassword(), account.getPassword()));
        verify(users).save(account);
    }

    @Test void refreshKeepsOldAdminRoleEvenForInactiveDemotedAccount() {
        var users = mock(UserRepository.class);
        var account = User.builder().id(901L).name("Audit Teacher").email("audit@example.invalid")
                .role(User.Role.TEACHER).isActive(false).build();
        when(users.findById(901L)).thenReturn(Optional.of(account));
        var provider = tokens();
        var service = new AuthService(users, new BCryptPasswordEncoder(4), provider);
        var refreshed = service.refresh(provider.createRefreshToken(901L, account.getEmail(), "ADMIN"));
        assertEquals("ADMIN", provider.getRole(refreshed.accessToken()));
        assertEquals("TEACHER", refreshed.user().role());
        assertFalse(refreshed.user().isActive());
    }

    @Test void accessTokenCanBeUsedToObtainRefreshToken() {
        var users = mock(UserRepository.class);
        var account = teacher();
        when(users.findById(account.getId())).thenReturn(Optional.of(account));
        var provider = tokens();
        var service = new AuthService(users, new BCryptPasswordEncoder(4), provider);
        var response = service.refresh(provider.createAccessToken(account.getId(), account.getEmail(), "TEACHER"));
        assertTrue(provider.validateToken(response.refreshToken()));
        assertTrue(provider.getClaims(response.refreshToken()).getExpiration().getTime()
                > provider.getClaims(response.accessToken()).getExpiration().getTime());
    }

    @Test void refreshTokenIsAcceptedAsApiAuthenticationWithoutDatabaseCheck() throws Exception {
        var users = mock(UserRepository.class);
        var provider = tokens();
        var request = new MockHttpServletRequest("GET", "/api/students/901");
        request.addHeader("Authorization", "Bearer " + provider.createRefreshToken(901L, "audit@example.invalid", "TEACHER"));
        try {
            new JwtAuthenticationFilter(provider, users).doFilter(request, new MockHttpServletResponse(), (req, res) -> {});
            assertNotNull(SecurityContextHolder.getContext().getAuthentication());
            assertTrue(SecurityContextHolder.getContext().getAuthentication().isAuthenticated());
            verifyNoInteractions(users);
        } finally { SecurityContextHolder.clearContext(); }
    }

    @Test void attendanceSavesStudentUnderUnrelatedClassWithoutCheckingTeacherAssignment() {
        var records = mock(AttendanceRepository.class);
        var students = mock(StudentRepository.class);
        var classes = mock(ClassGroupRepository.class);
        var users = mock(UserRepository.class);
        var reports = mock(DailyReportRepository.class);
        var assignments = mock(TeacherClassRepository.class);
        var requestedClass = ClassGroup.builder().id(911L).name("Audit Class A").build();
        var actualClass = ClassGroup.builder().id(912L).name("Audit Class B").build();
        var student = Student.builder().id(921L).name("Audit Student").classGroup(actualClass).build();
        when(classes.findById(911L)).thenReturn(Optional.of(requestedClass));
        when(users.findById(901L)).thenReturn(Optional.of(teacher()));
        when(students.findAllById(any())).thenReturn(List.of(student));
        var service = new AttendanceService(records, students, classes, users, reports, assignments);
        int saved = service.saveBatch(new AttendanceBatchRequest(911L, LocalDate.of(2026,1,4),
                List.of(new AttendanceBatchRequest.Record(921L, "PRESENT", "", ""))), 901L);
        var capture = ArgumentCaptor.forClass(Attendance.class);
        verify(records).save(capture.capture());
        assertEquals(1, saved);
        assertEquals(911L, capture.getValue().getClassGroup().getId());
        assertEquals(912L, capture.getValue().getStudent().getClassGroup().getId());
        verifyNoInteractions(assignments);
    }

    @Test void twoTeacherReportsProduceTwoRowsForOneClass() {
        var reports = mock(DailyReportRepository.class);
        var cg = ClassGroup.builder().id(911L).name("Audit Class").ageGroup("Audit Grade").build();
        var first = DailyReport.builder().classGroup(cg).teacher(teacher()).totalStudents(4).presentCount(3).absentCount(1).build();
        var second = DailyReport.builder().classGroup(cg).teacher(User.builder().id(902L).build()).totalStudents(4).presentCount(3).absentCount(1).build();
        when(reports.findByDateWithDetails(any())).thenReturn(List.of(first, second));
        var service = new AttendanceService(mock(AttendanceRepository.class), mock(StudentRepository.class),
                mock(ClassGroupRepository.class), mock(UserRepository.class), reports, mock(TeacherClassRepository.class));
        var summary = service.getAdminWeeklySummary(LocalDate.of(2026,1,4));
        assertEquals(2, summary.size());
        assertEquals(summary.get(0).classGroupId(), summary.get(1).classGroupId());
        assertEquals(8, summary.stream().mapToInt(row -> row.totalStudents()).sum());
    }

    @Test void legacyTtsAcceptsFutureWeekAndNonDayKeys() {
        var questions = mock(TtsQuestionRepository.class);
        var records = mock(TtsRecordRepository.class);
        var q = TtsQuestion.builder().id(931L).title("Audit Question").type(TtsQuestion.TtsQuestionType.DAYS).points(5).build();
        when(questions.findById(931L)).thenReturn(Optional.of(q));
        when(records.save(any(TtsRecord.class))).thenAnswer(inv -> inv.getArgument(0));
        var service = spy(new TtsService(questions, records, mock(TtsLegacyScoreRepository.class),
                mock(MeetingAttendanceRepository.class), mock(PrayerVoteRepository.class), mock(UserRepository.class), new ObjectMapper()));
        // Isolate request validation from the old endpoint's day-of-week opening restriction.
        doReturn(true).when(service).isSubmissionWindowOpen();
        var response = service.submitTts(teacher(), new TtsSubmitRequest(2099, 40,
                List.of(new TtsSubmitRequest.AnswerRequest(931L, "{\"not-a-day\":true}"))));
        assertEquals(2099, response.getYear());
        assertEquals(5, response.getScore());
    }

    @Configuration @EnableWebMvc @Import(SecurityConfig.class)
    static class MinimalWebConfig {
        @Bean UserRepository userRepository() { return mock(UserRepository.class); }
        @Bean JwtTokenProvider jwtTokenProvider() { return new JwtTokenProvider(SYNTHETIC_KEY, -1000, 604800000); }
        @Bean StudentService studentService() { return mock(StudentService.class); }
        @Bean StudentController studentController(StudentService service) { return new StudentController(service); }
    }

    @Test void teacherCanReachDirectDeactivationEndpointAndExpiredTokenReturns403() throws Exception {
        try (var context = new AnnotationConfigWebApplicationContext()) {
            context.setServletContext(new MockServletContext());
            context.register(MinimalWebConfig.class);
            context.refresh();
            var mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
            mvc.perform(patch("/api/students/921/deactivate").with(user("audit-user").roles("TEACHER")))
                    .andExpect(status().isOk());
            verify(context.getBean(StudentService.class)).deactivateStudent(921L);
            var expired = context.getBean(JwtTokenProvider.class).createAccessToken(901L, "audit@example.invalid", "TEACHER");
            mvc.perform(get("/api/students/921").header("Authorization", "Bearer " + expired))
                    .andExpect(status().isForbidden());
        } finally { SecurityContextHolder.clearContext(); }
    }
}
