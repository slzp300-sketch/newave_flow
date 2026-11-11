package com.newaveflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.AdminUserService;
import com.newaveflow.service.CommunitySafetyService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class BulkApprovalHttpTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired CommunityAgreementRepository agreements;
    @Autowired AccountDeletionRequestRepository deletions;
    @Autowired ClassGroupRepository classes;
    @Autowired TeacherClassRepository assignments;
    @Autowired AdminUserService service;
    @Autowired JwtTokenProvider tokens;
    @Autowired jakarta.persistence.EntityManager entityManager;

    User account(String name, User.Role role, boolean active) {
        var user=users.saveAndFlush(User.builder().name(name).email(name+"@example.invalid")
            .password("synthetic").role(role).isActive(active).build());
        agreements.saveAndFlush(new CommunityAgreement(user.getId(),CommunitySafetyService.POLICY_VERSION));
        return user;
    }
    String token(User user) { return "Bearer "+tokens.createAccessToken(user.getId(),user.getEmail(),user.getRole().name(),user.getAuthVersion()); }
    String body(List<Long> ids) throws Exception { return json.writeValueAsString(Map.of("userIds",ids)); }

    @Test void eachManagementRoleCanApproveAWholeSelectionWithoutAssigningOrChangingRoles() throws Exception {
        for(var role:List.of(User.Role.ADMIN,User.Role.PASTOR,User.Role.EXECUTIVE)) {
            var actor=account("bulk-actor-"+role,role,true);
            var first=account("bulk-first-"+role,User.Role.TEACHER,false);
            var second=account("bulk-second-"+role,User.Role.TEACHER,false);
            http.perform(patch("/api/admin/users/approve").header("Authorization",token(actor))
                .contentType("application/json").content(body(List.of(first.getId(),second.getId())))).andExpect(status().isOk());
            for(var user:List.of(first,second)) {
                assertTrue(user.isActive()); assertFalse(user.isSuspended());
                assertEquals(User.Role.TEACHER,user.getRole()); assertEquals(1,user.getAuthVersion());
                assertTrue(assignments.findByTeacherId(user.getId()).isEmpty());
            }
        }
    }

    @Test void invalidOrStaleTargetPreventsEveryOtherApprovalInTheBatch() throws Exception {
        var admin=account("atomic-admin",User.Role.ADMIN,true);
        var valid=account("atomic-pending",User.Role.TEACHER,false);
        var active=account("already-active",User.Role.TEACHER,true);
        var suspended=account("restricted-account",User.Role.TEACHER,true);
        service.suspendUser(admin,suspended.getId(),"Synthetic restriction",null);
        var wrongRole=account("pending-senior",User.Role.EXECUTIVE,false);
        var deleting=account("pending-deletion",User.Role.TEACHER,false);
        deletions.saveAndFlush(AccountDeletionRequest.builder().id(UUID.randomUUID().toString()).user(deleting).userCreatedAt(deleting.getCreatedAt())
            .receiptTokenHash("a".repeat(64)).status(AccountDeletionRequest.Status.REQUESTED).requestedAt(Instant.now()).targetAt(Instant.now().plusSeconds(3600)).build());
        for(var invalid:List.of(active,suspended,wrongRole,deleting)) {
            http.perform(patch("/api/admin/users/approve").header("Authorization",token(admin)).contentType("application/json")
                .content(body(List.of(valid.getId(),invalid.getId())))).andExpect(status().isConflict());
            assertFalse(valid.isActive()); assertEquals(0,valid.getAuthVersion());
        }
        http.perform(patch("/api/admin/users/approve").header("Authorization",token(admin)).contentType("application/json")
            .content(body(List.of(valid.getId(),999999L)))).andExpect(status().isNotFound());
        assertFalse(valid.isActive()); assertEquals(0,valid.getAuthVersion());
    }

    @Test void duplicateEmptyNonpositiveAndOversizedSelectionsCannotModifyAccounts() throws Exception {
        var admin=account("validation-admin",User.Role.ADMIN,true);
        var pending=account("validation-pending",User.Role.TEACHER,false);
        var huge=java.util.stream.LongStream.rangeClosed(1,101).boxed().toList();
        for(var ids:List.of(List.<Long>of(),List.of(pending.getId(),pending.getId()),List.of(0L),List.of(-1L),huge)) {
            http.perform(patch("/api/admin/users/approve").header("Authorization",token(admin)).contentType("application/json").content(body(ids)))
                .andExpect(status().isBadRequest());
            assertFalse(pending.isActive());
        }
        http.perform(patch("/api/admin/users/approve").header("Authorization",token(admin)).contentType("application/json").content("{\"userIds\":[null]}"))
            .andExpect(status().isBadRequest());
        assertFalse(pending.isActive());
    }

    @Test void ordinaryUnauthenticatedAndRevokedActorsCannotBulkApprove() throws Exception {
        var ordinary=account("bulk-ordinary",User.Role.TEACHER,true);
        var pending=account("bulk-protected-pending",User.Role.TEACHER,false);
        var payload=body(List.of(pending.getId()));
        http.perform(patch("/api/admin/users/approve").contentType("application/json").content(payload)).andExpect(status().isUnauthorized());
        http.perform(patch("/api/admin/users/approve").header("Authorization",token(ordinary)).contentType("application/json").content(payload)).andExpect(status().isForbidden());
        var admin=account("stale-bulk-admin",User.Role.ADMIN,true);
        entityManager.createNativeQuery("UPDATE users SET is_active=false,is_suspended=true,suspended_at=CURRENT_TIMESTAMP,auth_version=auth_version+1 WHERE id=:id")
            .setParameter("id",admin.getId()).executeUpdate();
        var denied=assertThrows(com.newaveflow.exception.AppException.class,()->service.approveUsers(admin,List.of(pending.getId())));
        assertEquals(401,denied.getStatus().value()); assertFalse(pending.isActive());
    }

    @Test void postApprovalAssignmentOnlyChangesTheChosenTeacherAndPreservesClassMembers() throws Exception {
        var admin=account("assignment-admin",User.Role.ADMIN,true);
        var old=account("existing-primary",User.Role.TEACHER,true);
        var assistant=account("existing-assistant",User.Role.TEACHER,true);
        var pending=account("approved-for-class",User.Role.TEACHER,false);
        var group=classes.saveAndFlush(ClassGroup.builder().name("Synthetic class").ageGroup("중1").build());
        assignments.saveAndFlush(TeacherClass.builder().teacher(old).classGroup(group).isPrimary(true).build());
        assignments.saveAndFlush(TeacherClass.builder().teacher(assistant).classGroup(group).isPrimary(false).build());
        http.perform(patch("/api/admin/users/approve").header("Authorization",token(admin)).contentType("application/json").content(body(List.of(pending.getId()))))
            .andExpect(status().isOk());
        http.perform(post("/api/classes/{classId}/assign-teacher/{userId}",group.getId(),pending.getId()).param("isPrimary","false").header("Authorization",token(admin)))
            .andExpect(status().isOk());
        assertTrue(assignments.findByClassGroup_IdAndTeacher_Id(group.getId(),old.getId()).orElseThrow().isPrimary());
        assertFalse(assignments.findByClassGroup_IdAndTeacher_Id(group.getId(),pending.getId()).orElseThrow().isPrimary());
        http.perform(post("/api/classes/{classId}/assign-teacher/{userId}",group.getId(),pending.getId()).param("isPrimary","true").header("Authorization",token(admin)))
            .andExpect(status().isOk());
        assertTrue(assignments.findByClassGroup_IdAndTeacher_Id(group.getId(),pending.getId()).orElseThrow().isPrimary());
        assertFalse(assignments.findByClassGroup_IdAndTeacher_Id(group.getId(),old.getId()).orElseThrow().isPrimary());
        assertTrue(assignments.findByClassGroup_IdAndTeacher_Id(group.getId(),assistant.getId()).isPresent());
        var notApproved=account("not-approved-for-class",User.Role.TEACHER,false);
        http.perform(post("/api/classes/{classId}/assign-teacher/{userId}",group.getId(),notApproved.getId()).param("isPrimary","true").header("Authorization",token(admin)))
            .andExpect(status().isConflict());
        assertTrue(assignments.findByClassGroup_IdAndTeacher_Id(group.getId(),notApproved.getId()).isEmpty());
        service.suspendUser(admin,pending.getId(),"Synthetic restriction after approval",null);
        http.perform(post("/api/classes/{classId}/assign-teacher/{userId}",group.getId(),pending.getId()).param("isPrimary","false").header("Authorization",token(admin)))
            .andExpect(status().isConflict());
    }
}
