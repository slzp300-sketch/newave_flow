package com.newaveflow;

import com.newaveflow.config.SecurityConfig;
import com.newaveflow.controller.StudentController;
import com.newaveflow.dto.auth.ResetPasswordRequest;
import com.newaveflow.dto.attendance.AttendanceBatchRequest;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import com.newaveflow.security.*;
import com.newaveflow.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.*;
import org.springframework.mock.web.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SecurityRegressionTest {
    static final String KEY = "synthetic-test-signing-key-never-used-in-production";
    JwtTokenProvider tokens() { return new JwtTokenProvider(KEY, 3600000, 604800000); }
    User teacher() { return User.builder().id(901L).email("audit@example.invalid").name("검증 교사").role(User.Role.TEACHER).build(); }

    @Test void publicResetNeverChangesPassword() {
        var users = mock(UserRepository.class);
        var service = new AuthService(users, new BCryptPasswordEncoder(4), tokens());
        assertThrows(AppException.class, () -> service.resetPassword(new ResetPasswordRequest("audit@example.invalid", "검증 교사", "01000000000")));
        verifyNoInteractions(users);
    }

    @Test void adminResetRequiresVerificationAndRevokesOldSessions() {
        var users = mock(UserRepository.class); var encoder = new BCryptPasswordEncoder(4); var account = teacher();
        when(users.lockById(901L)).thenReturn(Optional.of(account));
        var service = new AuthService(users, encoder, tokens());
        var admin = User.builder().id(902L).role(User.Role.ADMIN).build();
        assertThrows(AppException.class, () -> service.resetPasswordByAdmin(901L, teacher(), true));
        assertThrows(AppException.class, () -> service.resetPasswordByAdmin(901L, admin, false));
        var response = service.resetPasswordByAdmin(901L, admin, true);
        assertTrue(encoder.matches(response.tempPassword(), account.getPassword()));
        assertEquals(1, account.getAuthVersion());
    }

    @Test void refreshRejectsInactiveDemotedRevokedAndAccessTokens() {
        var users = mock(UserRepository.class); var provider = tokens(); var account = teacher();
        when(users.findById(901L)).thenReturn(Optional.of(account));
        var service = new AuthService(users, new BCryptPasswordEncoder(4), provider);
        assertThrows(AppException.class, () -> service.refresh(provider.createAccessToken(901L, account.getEmail(), "TEACHER")));
        assertThrows(AppException.class, () -> service.refresh(provider.createRefreshToken(901L, account.getEmail(), "ADMIN")));
        String before = provider.createRefreshToken(901L, account.getEmail(), "TEACHER");
        account.revokeSessions();
        assertThrows(AppException.class, () -> service.refresh(before));
        when(users.findById(901L)).thenReturn(Optional.of(User.builder().id(901L).role(User.Role.TEACHER).isActive(false).build()));
        assertThrows(AppException.class, () -> service.refresh(before));
    }

    @Test void validRefreshPreservesCurrentRoleAndVersion() {
        var users = mock(UserRepository.class); var provider = tokens(); var account = teacher(); account.revokeSessions();
        when(users.findById(901L)).thenReturn(Optional.of(account));
        var result = new AuthService(users, new BCryptPasswordEncoder(4), provider)
                .refresh(provider.createRefreshToken(901L, account.getEmail(), "TEACHER", 1));
        assertTrue(provider.matchesUser(provider.requireToken(result.accessToken(), "access"), account));
        assertThrows(IllegalArgumentException.class, () -> provider.requireToken(result.refreshToken(), "access"));
    }

    @Test void apiChecksCurrentAccountAndTokenPurpose() throws Exception {
        var users = mock(UserRepository.class); var provider = tokens(); var account = teacher();
        when(users.findById(901L)).thenReturn(Optional.of(account));
        var filter = new JwtAuthenticationFilter(provider, users);
        String access = provider.createAccessToken(901L, account.getEmail(), "TEACHER");
        for (String token : List.of(provider.createRefreshToken(901L, account.getEmail(), "TEACHER"), access)) {
            SecurityContextHolder.clearContext();
            var request = new MockHttpServletRequest(); request.addHeader("Authorization", "Bearer " + token);
            filter.doFilter(request, new MockHttpServletResponse(), (req, res) -> {});
            assertEquals(token.equals(access), SecurityContextHolder.getContext().getAuthentication() != null);
        }
        account.updateRole(User.Role.EXECUTIVE);
        SecurityContextHolder.clearContext();
        var request = new MockHttpServletRequest(); request.addHeader("Authorization", "Bearer " + access);
        filter.doFilter(request, new MockHttpServletResponse(), (req, res) -> {});
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        SecurityContextHolder.clearContext();
    }

    @Test void onlyAssignedTeachersOrManagementCanEditClass() {
        var assignments = mock(TeacherClassRepository.class); var access = new ClassAccessService(assignments);
        assertThrows(AppException.class, () -> access.requireClass(teacher(), 911L));
        when(assignments.findByClassGroup_IdAndTeacher_Id(911L, 901L)).thenReturn(Optional.of(TeacherClass.builder().build()));
        assertDoesNotThrow(() -> access.requireClass(teacher(), 911L));
        assertDoesNotThrow(() -> access.requireClass(User.builder().role(User.Role.ADMIN).build(), 912L));
    }

    @Test void rejectsStudentFromAnotherClassBeforeSaving() {
        var records = mock(AttendanceRepository.class); var students = mock(StudentRepository.class);
        var classes = mock(ClassGroupRepository.class); var users = mock(UserRepository.class);
        var assignments = mock(TeacherClassRepository.class); var reports = mock(DailyReportRepository.class);
        var requested = ClassGroup.builder().id(911L).build();
        when(classes.lockById(911L)).thenReturn(Optional.of(requested)); when(users.findById(901L)).thenReturn(Optional.of(teacher()));
        when(assignments.findByClassGroup_IdAndTeacher_Id(911L,901L)).thenReturn(Optional.of(TeacherClass.builder().build()));
        when(students.findAllById(any())).thenReturn(List.of(Student.builder().id(921L).classGroup(ClassGroup.builder().id(912L).build()).build()));
        var service = new AttendanceService(records, students, classes, users, reports, assignments, new ClassAccessService(assignments));
        assertThrows(AppException.class, () -> service.saveBatch(new AttendanceBatchRequest(911L, LocalDate.of(2026,1,4),
                List.of(new AttendanceBatchRequest.Record(921L,"PRESENT","",""))),901L));
        verify(records,never()).save(any()); verifyNoInteractions(reports);
    }

    @Configuration @EnableWebMvc @Import(SecurityConfig.class)
    static class MinimalWeb {
        @Bean UserRepository users() { return mock(UserRepository.class); }
        @Bean JwtTokenProvider provider() { return new JwtTokenProvider(KEY,-1000,604800000); }
        @Bean StudentService students() { return mock(StudentService.class); }
        @Bean StudentController controller(StudentService students) { return new StudentController(students); }
    }

    @Test void directDeactivationIsForbiddenForTeacherAndExpiredTokenIs401() throws Exception {
        try (var context = new AnnotationConfigWebApplicationContext()) {
            context.setServletContext(new MockServletContext()); context.register(MinimalWeb.class); context.refresh();
            var mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
            mvc.perform(patch("/api/students/921/deactivate").with(user("teacher").roles("TEACHER"))).andExpect(status().isForbidden());
            verifyNoInteractions(context.getBean(StudentService.class));
            mvc.perform(patch("/api/students/921/deactivate").with(user("admin").roles("ADMIN"))).andExpect(status().isOk());
            String expired = context.getBean(JwtTokenProvider.class).createAccessToken(901L,"audit@example.invalid","TEACHER");
            mvc.perform(get("/api/students/921").header("Authorization","Bearer " + expired)).andExpect(status().isUnauthorized());
        } finally { SecurityContextHolder.clearContext(); }
    }
}
