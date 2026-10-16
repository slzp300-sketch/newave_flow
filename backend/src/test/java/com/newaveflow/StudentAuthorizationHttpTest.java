package com.newaveflow;

import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.ClassService;
import com.newaveflow.service.CommunitySafetyService;
import com.newaveflow.service.StudentService;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class StudentAuthorizationHttpTest {
    @Autowired MockMvc http;
    @Autowired UserRepository users;
    @Autowired StudentRepository students;
    @Autowired ClassGroupRepository classes;
    @Autowired TeacherClassRepository assignments;
    @Autowired CommunityAgreementRepository agreements;
    @Autowired JwtTokenProvider tokens;
    @Autowired StudentService studentService;
    @Autowired ClassService classService;
    private User teacher, unassigned;
    private ClassGroup ownClass, secondaryClass, otherClass;
    private Student ownStudent, secondaryStudent, otherStudent;

    @BeforeEach void setup() {
        teacher = account("synthetic-assigned", User.Role.TEACHER);
        unassigned = account("synthetic-unassigned", User.Role.TEACHER);
        ownClass = classes.saveAndFlush(ClassGroup.builder().name("Synthetic primary class").build());
        secondaryClass = classes.saveAndFlush(ClassGroup.builder().name("Synthetic secondary class").build());
        otherClass = classes.saveAndFlush(ClassGroup.builder().name("Synthetic other class").build());
        assignments.saveAndFlush(TeacherClass.builder().teacher(teacher).classGroup(ownClass).isPrimary(true).build());
        assignments.saveAndFlush(TeacherClass.builder().teacher(teacher).classGroup(secondaryClass).isPrimary(false).build());
        ownStudent = student("Synthetic assigned student", ownClass);
        secondaryStudent = student("Synthetic secondary student", secondaryClass);
        otherStudent = student("Synthetic other student", otherClass);
    }

    private User account(String name, User.Role role) {
        var user = users.saveAndFlush(User.builder().name(name).email(name + "@example.invalid")
            .password("synthetic-only").role(role).build());
        agreements.saveAndFlush(new CommunityAgreement(user.getId(), CommunitySafetyService.POLICY_VERSION));
        return user;
    }

    private Student student(String name, ClassGroup group) {
        return students.saveAndFlush(Student.builder().name(name).classGroup(group)
            .phone("01000000000").fatherPhone("01011111111")
            .address("Synthetic private address").build());
    }

    private String token(User user) {
        return "Bearer " + tokens.createAccessToken(user.getId(), user.getEmail(), user.getRole().name(), user.getAuthVersion());
    }

    private String[] endpoints(Student student) {
        return new String[]{"/api/students/" + student.getId(), "/api/classes/" + student.getClassGroup().getId() + "/students"};
    }

    @Test void primaryAndSecondaryTeachersCanReadOnlyTheirAssignedStudents() throws Exception {
        for (Student student : new Student[]{ownStudent, secondaryStudent}) {
            http.perform(get(endpoints(student)[0]).header("Authorization", token(teacher)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(student.getId()))
                .andExpect(jsonPath("$.fatherPhone").value("01011111111"));
            http.perform(get(endpoints(student)[1]).header("Authorization", token(teacher)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(student.getId()))
                .andExpect(jsonPath("$[0].address").value("Synthetic private address"));
        }
        for (User actor : new User[]{teacher, unassigned}) {
            for (String endpoint : endpoints(otherStudent)) {
                String body = http.perform(get(endpoint).header("Authorization", token(actor))
                    .param("userId", teacher.getId().toString()).param("teacherId", teacher.getId().toString()))
                    .andExpect(status().isForbidden()).andReturn().getResponse().getContentAsString();
                assertFalse(body.contains(otherStudent.getName()));
                assertFalse(body.contains("01011111111"));
                assertFalse(body.contains("Synthetic private address"));
            }
        }
        for (String endpoint : endpoints(ownStudent)) {
            http.perform(get(endpoint).header("Authorization", token(unassigned))
                .param("userId", teacher.getId().toString()))
                .andExpect(status().isForbidden());
        }
    }

    @Test void missingOrInactiveAuthenticationCannotReadEitherEndpoint() throws Exception {
        String previousToken = token(teacher);
        teacher.suspend(); users.saveAndFlush(teacher);
        for (String endpoint : endpoints(ownStudent)) {
            http.perform(get(endpoint)).andExpect(status().isUnauthorized());
            http.perform(get(endpoint).header("Authorization", previousToken)).andExpect(status().isUnauthorized());
        }
    }

    @Test void removingAnAssignmentImmediatelyRemovesReadAccessForAnExistingSession() throws Exception {
        String currentToken = token(teacher);
        assignments.deleteByClassGroup_IdAndTeacher_Id(ownClass.getId(), teacher.getId());
        assignments.flush();
        for (String endpoint : endpoints(ownStudent)) {
            http.perform(get(endpoint).header("Authorization", currentToken)).andExpect(status().isForbidden());
        }
        http.perform(get(endpoints(secondaryStudent)[0]).header("Authorization", currentToken)).andExpect(status().isOk());
    }

    @ParameterizedTest @EnumSource(value = User.Role.class, names = {"ADMIN", "PASTOR", "EXECUTIVE"})
    void explicitManagementRolesRetainAccessWithoutAClassAssignment(User.Role role) throws Exception {
        User manager = account("synthetic-manager-" + role.name().toLowerCase(), role);
        for (String endpoint : endpoints(otherStudent)) {
            http.perform(get(endpoint).header("Authorization", token(manager))).andExpect(status().isOk());
        }
    }

    @Test void serviceEntryPointsNeverDefaultMissingOrInvalidActorsToManagement() {
        User inactive = User.builder().id(teacher.getId()).role(User.Role.TEACHER).isActive(false).build();
        User missingRole = User.builder().id(teacher.getId()).build();
        User missingIdentity = User.builder().role(User.Role.TEACHER).build();
        for (User actor : new User[]{null, inactive, missingRole, missingIdentity}) {
            assertThrows(AppException.class, () -> studentService.getStudentById(ownStudent.getId(), actor));
            assertThrows(AppException.class, () -> classService.getStudentsInClass(ownClass.getId(), actor));
        }
    }

    @Test void sharedRosterKeepsOnlyTheExistingStudentSummary() throws Exception {
        String body = http.perform(get("/api/classes/roster").header("Authorization", token(unassigned)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(body.contains(otherStudent.getName()));
        assertFalse(body.contains("01000000000"));
        assertFalse(body.contains("01011111111"));
        assertFalse(body.contains("Synthetic private address"));
    }
}
