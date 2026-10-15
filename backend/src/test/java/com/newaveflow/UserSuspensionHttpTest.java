package com.newaveflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.AdminUserService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class UserSuspensionHttpTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired UserStatusEventRepository events;
    @Autowired AccountDeletionRequestRepository deletions;
    @Autowired CommunityAgreementRepository agreements;
    @Autowired AdminUserService service;
    @Autowired JwtTokenProvider tokens;
    @Autowired jakarta.persistence.EntityManager entityManager;
    User admin, pastor, executive, teacher, pending;

    @BeforeEach void setup() {
        admin = account("status-admin", User.Role.ADMIN, true);
        pastor = account("status-pastor", User.Role.PASTOR, true);
        executive = account("status-executive", User.Role.EXECUTIVE, true);
        teacher = account("status-teacher", User.Role.TEACHER, true);
        pending = account("status-pending", User.Role.TEACHER, false);
    }
    User account(String name, User.Role role, boolean active) {
        var user = users.saveAndFlush(User.builder().name(name).email(name+"@example.invalid").password("synthetic").role(role).isActive(active).build());
        agreements.saveAndFlush(new CommunityAgreement(user.getId(), com.newaveflow.service.CommunitySafetyService.POLICY_VERSION));
        return user;
    }
    String token(User user) { return "Bearer " + tokens.createAccessToken(user.getId(), user.getEmail(), user.getRole().name(), user.getAuthVersion()); }
    String body(Object value) throws Exception { return json.writeValueAsString(value); }
    void suspend(User user) { service.suspendUser(admin, user.getId(), "Synthetic safety restriction", null); users.flush(); }
    Map<String,Object> restorePayload(User user) { return Map.of("reason", "Synthetic issue resolved and reviewed", "expectedAuthVersion", user.getAuthVersion()); }

    @Test void suspensionIsNotPendingAndApprovalCannotBypassIt() throws Exception {
        suspend(teacher);
        http.perform(get("/api/admin/users/pending").header("Authorization",token(admin)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].id").value(pending.getId())).andExpect(jsonPath("$[0].accountStatus").value("PENDING"));
        http.perform(get("/api/admin/users/suspended").header("Authorization",token(admin)))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].user.accountStatus").value("SUSPENDED"))
            .andExpect(jsonPath("$[0].user.id").value(teacher.getId())).andExpect(jsonPath("$[0].reason").value("Synthetic safety restriction"));
        for (User actor : List.of(admin, pastor, executive)) {
            http.perform(patch("/api/admin/users/"+teacher.getId()+"/approve").header("Authorization",token(actor)).contentType("application/json").content("{}"))
                .andExpect(status().isConflict());
        }
        assertFalse(teacher.isActive()); assertTrue(teacher.isSuspended()); assertEquals(1,events.count());
        http.perform(patch("/api/admin/users/"+pending.getId()+"/approve").header("Authorization",token(executive)).contentType("application/json").content("{}"))
            .andExpect(status().isOk());
        assertTrue(pending.isActive()); assertFalse(pending.isSuspended());
    }

    @Test void onlyAdminCanRestoreAndHistoryIsPrivateToManagement() throws Exception {
        suspend(teacher);
        for (User actor : List.of(pastor, executive, pending)) {
            http.perform(patch("/api/admin/users/"+teacher.getId()+"/restore").header("Authorization",token(actor)).contentType("application/json").content(body(restorePayload(teacher))))
                .andExpect(status().is(actor.isActive() ? 403 : 401));
        }
        User ordinary = account("status-reader",User.Role.TEACHER,true);
        for (String path : List.of("/api/admin/users/suspended", "/api/admin/users/"+teacher.getId()+"/status-history")) {
            http.perform(get(path).header("Authorization",token(ordinary))).andExpect(status().isForbidden());
            http.perform(get(path)).andExpect(status().isUnauthorized());
        }
        http.perform(get("/api/admin/users/"+teacher.getId()+"/status-history").header("Authorization",token(executive)))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].action").value("SUSPEND"));
        http.perform(patch("/api/admin/users/"+teacher.getId()+"/restore").header("Authorization",token(admin)).contentType("application/json").content(body(restorePayload(teacher))))
            .andExpect(status().isOk());
        assertTrue(teacher.isActive()); assertFalse(teacher.isSuspended()); assertNull(teacher.getSuspendedAt());
        var history=events.findTop100ByUserIdOrderByCreatedAtDescIdDesc(teacher.getId());
        assertEquals(2,history.size()); assertEquals(UserStatusEvent.Action.RESTORE,history.get(0).getAction());
        assertEquals(admin.getId(),history.get(0).getActorId());
    }

    @Test void restorationNeverResurrectsOldAccessOrRefreshTokens() throws Exception {
        String oldAccess=token(teacher);
        String oldRefresh=tokens.createRefreshToken(teacher.getId(),teacher.getEmail(),teacher.getRole().name(),teacher.getAuthVersion());
        suspend(teacher);
        http.perform(get("/api/users/me").header("Authorization",oldAccess)).andExpect(status().isUnauthorized());
        http.perform(patch("/api/admin/users/"+teacher.getId()+"/restore").header("Authorization",token(admin)).contentType("application/json").content(body(restorePayload(teacher))))
            .andExpect(status().isOk());
        assertEquals(2,teacher.getAuthVersion());
        http.perform(get("/api/users/me").header("Authorization",oldAccess)).andExpect(status().isUnauthorized());
        http.perform(post("/api/auth/refresh").contentType("application/json").content(body(Map.of("refreshToken",oldRefresh)))).andExpect(status().isUnauthorized());
        http.perform(get("/api/users/me").header("Authorization",token(teacher))).andExpect(status().isOk());
    }

    @Test void restorationRequiresReasonCurrentVersionAndSuspendedState() throws Exception {
        suspend(teacher);
        for (Object payload:List.of(Map.of("reason"," ","expectedAuthVersion",teacher.getAuthVersion()), Map.of("reason","Synthetic review"))) {
            http.perform(patch("/api/admin/users/"+teacher.getId()+"/restore").header("Authorization",token(admin)).contentType("application/json").content(body(payload)))
                .andExpect(status().isBadRequest());
        }
        http.perform(patch("/api/admin/users/"+teacher.getId()+"/restore").header("Authorization",token(admin)).contentType("application/json")
            .content(body(Map.of("reason","Synthetic review","expectedAuthVersion",0)))).andExpect(status().isConflict());
        http.perform(patch("/api/admin/users/"+pending.getId()+"/restore").header("Authorization",token(admin)).contentType("application/json").content(body(restorePayload(pending))))
            .andExpect(status().isConflict());
        assertTrue(teacher.isSuspended()); assertFalse(pending.isActive()); assertEquals(1,events.count());
    }

    @Test void deletionRequestBlocksRestoreAndApproval() throws Exception {
        suspend(teacher);
        for (User user : List.of(teacher,pending)) {
            deletions.saveAndFlush(AccountDeletionRequest.builder().id(UUID.randomUUID().toString()).user(user).userCreatedAt(user.getCreatedAt())
                .receiptTokenHash(UUID.randomUUID().toString().replace("-", "").repeat(2)).status(AccountDeletionRequest.Status.REQUESTED)
                .requestedAt(Instant.now()).targetAt(Instant.now().plusSeconds(86400)).build());
        }
        http.perform(patch("/api/admin/users/"+teacher.getId()+"/restore").header("Authorization",token(admin)).contentType("application/json").content(body(restorePayload(teacher))))
            .andExpect(status().isConflict());
        http.perform(patch("/api/admin/users/"+pending.getId()+"/approve").header("Authorization",token(admin)).contentType("application/json").content("{}"))
            .andExpect(status().isConflict());
        assertTrue(teacher.isSuspended()); assertFalse(pending.isActive());
    }

    @Test void selfSuspensionSelfRestorationAndPrivilegeEscalationAreRejected() throws Exception {
        var self = assertThrows(com.newaveflow.exception.AppException.class,()->service.suspendUser(admin,admin.getId(),"Synthetic",null));
        assertEquals(403,self.getStatus().value());
        for(User actor:List.of(pastor,executive)) for(User target:List.of(admin,pastor)) {
            var denied=assertThrows(com.newaveflow.exception.AppException.class,()->service.suspendUser(actor,target.getId(),"Synthetic",null));
            assertEquals(403,denied.getStatus().value());
        }
        var denied=assertThrows(com.newaveflow.exception.AppException.class,()->service.restoreUser(admin,admin.getId(),"Synthetic",admin.getAuthVersion()));
        assertEquals(403,denied.getStatus().value());
        assertTrue(admin.isActive()); assertEquals(0,events.count());
    }

    @Test void lastAdminCannotBeDemotedAndSuspendedAccountsCannotChangeRoles() throws Exception {
        http.perform(put("/api/users/"+admin.getId()+"/role").header("Authorization",token(admin)).contentType("application/json").content("{\"role\":\"TEACHER\"}"))
            .andExpect(status().isConflict());
        suspend(teacher);
        http.perform(put("/api/users/"+teacher.getId()+"/role").header("Authorization",token(admin)).contentType("application/json").content("{\"role\":\"EXECUTIVE\"}"))
            .andExpect(status().isConflict());
        assertEquals(User.Role.ADMIN,admin.getRole()); assertEquals(User.Role.TEACHER,teacher.getRole());
    }

    @Test void secondAdminMayBeRestrictedButThatAdminCannotUndoIt() throws Exception {
        User second=account("status-second-admin",User.Role.ADMIN,true);
        String old=token(second);
        service.suspendUser(admin,second.getId(),"Synthetic admin restriction",null);
        http.perform(patch("/api/admin/users/"+second.getId()+"/restore").header("Authorization",old).contentType("application/json").content(body(restorePayload(second))))
            .andExpect(status().isUnauthorized());
        http.perform(put("/api/users/"+admin.getId()+"/role").header("Authorization",token(admin)).contentType("application/json").content("{\"role\":\"TEACHER\"}"))
            .andExpect(status().isConflict());
        assertTrue(second.isSuspended()); assertTrue(admin.isActive());
    }

    @Test void restorationDoesNotBypassSeniorRoleLimit() throws Exception {
        User second=account("status-third-admin",User.Role.ADMIN,true);
        suspend(second);
        http.perform(patch("/api/admin/users/"+second.getId()+"/restore").header("Authorization",token(admin)).contentType("application/json").content(body(restorePayload(second))))
            .andExpect(status().isConflict());
        assertTrue(second.isSuspended());
    }

    @Test void staleManagedActorCannotApproveAfterAnotherTransactionChangedAccountState() {
        long originalVersion=admin.getAuthVersion();
        entityManager.createNativeQuery("UPDATE users SET is_active=false,is_suspended=true,suspended_at=CURRENT_TIMESTAMP,auth_version=auth_version+1 WHERE id=:id")
            .setParameter("id",admin.getId()).executeUpdate();
        // The OSIV principal still has its original state until the transition refreshes it.
        assertTrue(admin.isActive()); assertEquals(originalVersion,admin.getAuthVersion());
        var denied=assertThrows(com.newaveflow.exception.AppException.class,()->service.approveUser(admin,pending.getId(),null));
        assertEquals(401,denied.getStatus().value());
        assertFalse(pending.isActive()); assertEquals(0,events.count());
    }
}
