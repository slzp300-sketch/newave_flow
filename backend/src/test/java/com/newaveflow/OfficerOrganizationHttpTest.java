package com.newaveflow;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.*;
import com.newaveflow.service.OfficerOrganizationService.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class OfficerOrganizationHttpTest {
    @Autowired MockMvc http; @Autowired ObjectMapper json; @Autowired UserRepository users;
    @Autowired OfficerOrganizationService organization; @Autowired OfficerAccessService access;
    @Autowired CommunityAgreementRepository agreements; @Autowired JwtTokenProvider tokens;
    @Autowired OfficerAppointmentRepository appointments; @Autowired AdminUserService roles;
    int year(){return LocalDate.now(OfficerAccessService.ZONE).getYear();}
    User user(User.Role role){var u=users.saveAndFlush(User.builder().name("가상"+role).email(UUID.randomUUID()+"@example.invalid").password("synthetic").role(role).build());agreements.saveAndFlush(new CommunityAgreement(u.getId(),CommunitySafetyService.POLICY_VERSION));return u;}
    User fresh(User u){return users.findById(u.getId()).orElseThrow();}
    String auth(User u){u=fresh(u);return "Bearer "+tokens.createAccessToken(u.getId(),u.getEmail(),u.getRole().name(),u.getAuthVersion());}
    Organization assign(User admin,int y,OfficerPosition p,User u){return organization.assign(y,p,new Assignment(organization.get(y,fresh(admin)).revision(),u==null?null:u.getId()),fresh(admin));}
    @Test void has18OfficesAndOnlyAdminAssignsWithoutInferringProfileOrGender()throws Exception {
        var admin=user(User.Role.ADMIN);var pastor=user(User.Role.PASTOR);var exec=user(User.Role.EXECUTIVE);var teacher=user(User.Role.TEACHER);
        assertEquals(18,organization.get(null,admin).offices().size());
        for(var u:List.of(exec,pastor,teacher))http.perform(put("/api/officers/organization/{year}/SECRETARY",year()).header("Authorization",auth(u)).contentType("application/json").content("{\"revision\":0,\"userId\":"+teacher.getId()+"}")).andExpect(status().isForbidden());
        http.perform(get("/api/officers/organization").header("Authorization",auth(teacher))).andExpect(status().isForbidden());
        http.perform(get("/api/officers/me").header("Authorization",auth(exec))).andExpect(jsonPath("$.canReport").value(false));
        teacher.updateProfile("가상교사",null,null,null,"서기");users.flush();assertFalse(access.canReport(teacher));
        assertThrows(com.newaveflow.exception.AppException.class,()->assign(admin,year(),OfficerPosition.PASTOR,teacher));
        assign(admin,year(),OfficerPosition.PASTOR,pastor);assign(admin,year(),OfficerPosition.DEPUTY_FEMALE,exec);
        assertEquals(User.Role.EXECUTIVE,fresh(exec).getRole());
    }
    @Test void grantsCommonAndSecretaryAccessAndRevokesAfterLastOffice()throws Exception {
        var admin=user(User.Role.ADMIN);var teacher=user(User.Role.TEACHER);String oldToken=auth(teacher);
        var result=assign(admin,year(),OfficerPosition.SECRETARY,teacher);
        assertEquals(User.Role.EXECUTIVE,fresh(teacher).getRole());assertTrue(fresh(teacher).isOrganizationExecutive());
        http.perform(get("/api/officers/me").header("Authorization",oldToken)).andExpect(status().isUnauthorized());
        String day=LocalDate.now().with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY)).toString();
        http.perform(get("/api/weekly-reports/"+day).header("Authorization",auth(teacher))).andExpect(status().isOk());
        assign(admin,year(),OfficerPosition.GRADE_M1,teacher);assign(admin,year(),OfficerPosition.SECRETARY,null);
        assertEquals(User.Role.EXECUTIVE,fresh(teacher).getRole());assertFalse(access.canReport(fresh(teacher)));
        for(String suffix:List.of("","/preview"))http.perform(get("/api/weekly-reports/"+day+suffix).header("Authorization",auth(teacher))).andExpect(status().isForbidden());
        http.perform(put("/api/weekly-reports/"+day).header("Authorization",auth(teacher)).contentType("application/json").content("{\"revision\":0,\"fields\":{}}")).andExpect(status().isForbidden());
        http.perform(post("/api/weekly-reports/"+day+"/exports").header("Authorization",auth(teacher)).contentType("application/json").content("{\"sourceHash\":\"x\",\"draftRevision\":0}")).andExpect(status().isForbidden());
        http.perform(get("/api/weekly-reports/exports/1/pdf").header("Authorization",auth(teacher))).andExpect(status().isForbidden());
        http.perform(get("/api/weekly-reports/"+day+"/attendance").header("Authorization",auth(teacher))).andExpect(status().isOk()).andExpect(jsonPath("$.fields").doesNotExist()).andExpect(jsonPath("$.exports").doesNotExist());
        assign(admin,year(),OfficerPosition.GRADE_M1,null);assertEquals(User.Role.TEACHER,fresh(teacher).getRole());
        assertTrue(organization.get(year(),fresh(admin)).history().size()>=4);
    }
    @Test void futureAppointmentsStayInactiveUntilExplicitActivationAndPreserveLegacyRoles() {
        var admin=user(User.Role.ADMIN);var legacy=user(User.Role.EXECUTIVE);var teacher=user(User.Role.TEACHER);
        assign(admin,year(),OfficerPosition.SECRETARY,legacy);
        var next=assign(admin,year()+1,OfficerPosition.SECRETARY,teacher);
        assertEquals(User.Role.TEACHER,fresh(teacher).getRole());assertFalse(access.canReport(fresh(teacher)));assertTrue(access.canReport(fresh(legacy)));
        organization.activate(year()+1,new Activation(next.revision()),fresh(admin));
        assertTrue(access.canReport(fresh(teacher)));assertFalse(access.canReport(fresh(legacy)));assertEquals(User.Role.EXECUTIVE,fresh(legacy).getRole());
        organization.activate(year(),new Activation(organization.get(year(),fresh(admin)).revision()),fresh(admin));
        assertEquals(User.Role.TEACHER,fresh(teacher).getRole());assertTrue(access.canReport(fresh(legacy)));
    }
    @Test void newFamilyChairUsesExistingWorkflowWithoutGrantingFinalAssignment()throws Exception {
        var admin=user(User.Role.ADMIN);var chair=user(User.Role.EXECUTIVE);var member=user(User.Role.TEACHER);
        member.updateNewFamilyTeam(true);users.flush();assign(admin,year(),OfficerPosition.NEW_FAMILY,chair);
        http.perform(get("/api/new-family/capability").header("Authorization",auth(chair))).andExpect(jsonPath("$.canManage").value(true)).andExpect(jsonPath("$.canAssign").value(false));
        http.perform(get("/api/new-family/people").header("Authorization",auth(chair))).andExpect(status().isOk());
        assign(admin,year(),OfficerPosition.NEW_FAMILY,null);
        http.perform(get("/api/new-family/people").header("Authorization",auth(chair))).andExpect(status().isForbidden());
        http.perform(get("/api/new-family/people").header("Authorization",auth(member))).andExpect(status().isOk());
    }
    @Test void activationRechecksAccountStatusBeforeChangingAnyAuthority() {
        var admin=user(User.Role.ADMIN);var active=user(User.Role.EXECUTIVE);var next=user(User.Role.TEACHER);
        assign(admin,year(),OfficerPosition.SECRETARY,active);
        var prepared=assign(admin,year()+1,OfficerPosition.SECRETARY,next);
        fresh(next).suspend();users.flush();
        long firstRevision=prepared.revision();
        assertThrows(com.newaveflow.exception.AppException.class,()->organization.activate(year()+1,new Activation(firstRevision),fresh(admin)));
        assertEquals(year(),access.activeYear());assertTrue(access.canReport(fresh(active)));
        assertEquals(User.Role.TEACHER,fresh(next).getRole());
        var pastor=user(User.Role.PASTOR);assign(admin,year()+1,OfficerPosition.SECRETARY,null);
        prepared=assign(admin,year()+1,OfficerPosition.PASTOR,pastor);
        fresh(pastor).updateRole(User.Role.EXECUTIVE);users.flush();
        long revision=prepared.revision();
        assertThrows(com.newaveflow.exception.AppException.class,()->organization.activate(year()+1,new Activation(revision),fresh(admin)));
        assertEquals(year(),access.activeYear());assertTrue(access.canReport(fresh(active)));
    }
    @Test void staleAssignmentAndInvalidTargetAreAtomicAndRoleChangesCannotLeaveActiveTeacherOffices() {
        var admin=user(User.Role.ADMIN);var a=user(User.Role.TEACHER);var b=user(User.Role.TEACHER);
        assign(admin,year(),OfficerPosition.SECRETARY,a);
        assertThrows(com.newaveflow.exception.AppException.class,()->organization.assign(year(),OfficerPosition.SECRETARY,new Assignment(0L,b.getId()),fresh(admin)));
        assertTrue(access.canReport(fresh(a)));assertEquals(User.Role.TEACHER,fresh(b).getRole());
        assertThrows(com.newaveflow.exception.AppException.class,()->roles.updateRole(fresh(admin),a.getId(),User.Role.TEACHER));
        var suspended=fresh(b);suspended.suspend();users.flush();
        assertThrows(com.newaveflow.exception.AppException.class,()->assign(fresh(admin),year(),OfficerPosition.SECRETARY,suspended));
        assertTrue(access.canReport(fresh(a)));assertEquals(1,appointments.findByTermYear(year()).size());
    }
}
