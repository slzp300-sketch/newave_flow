package com.newaveflow;

import com.fasterxml.jackson.databind.*;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.ContentTextFilter;
import com.newaveflow.service.CommunitySafetyService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class ContentModerationHttpTest {
    @Autowired MockMvc http; @Autowired ObjectMapper json;
    @Autowired UserRepository users; @Autowired ModeratedPhotoRepository photos;
    @Autowired ContentReportRepository reports; @Autowired CommunityAgreementRepository agreements;
    @Autowired ClassGroupRepository classes; @Autowired TeacherClassRepository assignments;
    @Autowired StudentRepository students; @Autowired DailyReportRepository dailyReports;
    @Autowired EventRepository events; @Autowired MeetingMinuteRepository minutes;
    @Autowired JwtTokenProvider tokens;
    @Autowired jakarta.persistence.EntityManager entityManager;
    User teacher,other,admin; ClassGroup group; Student student;
    @BeforeEach void setup() {
        teacher=account("moderation-teacher",User.Role.TEACHER);
        other=account("moderation-other",User.Role.TEACHER);
        admin=account("moderation-admin",User.Role.ADMIN);
        group=classes.saveAndFlush(ClassGroup.builder().name("Synthetic moderation class").build());
        assignments.saveAndFlush(TeacherClass.builder().teacher(teacher).classGroup(group).build());
        student=students.saveAndFlush(Student.builder().name("Synthetic student").classGroup(group).build());
        for(var u:List.of(teacher,other,admin)) agreements.saveAndFlush(new CommunityAgreement(u.getId(),CommunitySafetyService.POLICY_VERSION));
    }
    User account(String name,User.Role role) {
        return users.saveAndFlush(User.builder().name(name).email(name+"@example.invalid").password("synthetic").role(role).build());
    }
    String token(User u) { return "Bearer "+tokens.createAccessToken(u.getId(),u.getEmail(),u.getRole().name(),u.getAuthVersion()); }
    String body(Object payload) throws Exception { return json.writeValueAsString(payload); }
    String image(int color) throws Exception {
        var bitmap=new BufferedImage(2,2,BufferedImage.TYPE_INT_RGB); bitmap.setRGB(0,0,color);
        var out=new ByteArrayOutputStream(); ImageIO.write(bitmap,"png",out);
        return "data:image/png;base64,"+Base64.getEncoder().encodeToString(out.toByteArray());
    }
    Map<String,Object> profile(String picture) {
        var p=new LinkedHashMap<String,Object>(); p.put("name",teacher.getName());p.put("profileImage",picture); return p;
    }
    void updateProfile(String picture) throws Exception {
        http.perform(put("/api/users/me/profile").header("Authorization",token(teacher)).contentType("application/json").content(body(profile(picture))))
            .andExpect(status().isOk());
    }
    JsonNode photo() throws Exception {
        return json.readTree(http.perform(get("/api/safety/admin/photos").header("Authorization",token(admin)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("content").get(0);
    }
    void review(JsonNode photo,String decision,long revision,int result) throws Exception {
        // Separate HTTP calls commit in production; this enclosing test transaction must flush
        // before review deliberately refreshes its locked entity from the database.
        entityManager.flush();
        http.perform(patch("/api/safety/admin/photos/"+photo.get("id").asLong()).header("Authorization",token(admin)).contentType("application/json")
            .content(body(Map.of("decision",decision,"expectedRevision",revision,"note","Synthetic photo review"))))
            .andExpect(status().is(result));
    }
    JsonNode report(String type,Long targetId) throws Exception {
        var request=Map.of("targetType","CONTENT","contentType",type,"targetId",targetId,"reason","PRIVACY",
            "details","Synthetic concern","requestId",UUID.randomUUID().toString());
        return json.readTree(http.perform(post("/api/safety/reports").header("Authorization",token(teacher)).contentType("application/json").content(body(request)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
    void resolve(JsonNode report,String action,int status) throws Exception {
        http.perform(patch("/api/safety/admin/reports/"+report.get("id").asLong()).header("Authorization",token(admin)).contentType("application/json")
            .content(body(Map.of("status","RESOLVED","action",action,"expectedRevision",report.get("revision").asLong(),"note","Synthetic protection applied"))))
            .andExpect(status().is(status));
    }
    @Test void localFilterCatchesNormalizedThreatsAndAllowsOrdinarySensitiveWorkNotes() {
        for(String text:List.of("너를 죽이겠다","너를\u200B죽 이 겠 다","ＦＵＣＫ ＹＯＵ","아동 성착취물 판매"))
            assertThrows(com.newaveflow.exception.AppException.class,()->ContentTextFilter.check(text));
        assertDoesNotThrow(()->ContentTextFilter.check("성폭력 피해 상담과 회복을 위해 기도합니다.","아동 성착취물 예방 교육", "바울: 나는 날마다 죽노라", "죽음과 부활에 관한 성경 공부", "김사랑 이믿음"));
    }
    @Test void oldClientWritesAreFilteredButReportingQuotedAbuseRemainsPossible() throws Exception {
        http.perform(put("/api/users/me/profile").header("Authorization",token(teacher)).contentType("application/json")
            .content(body(Map.of("name","너를 죽이겠다")))).andExpect(status().isBadRequest());
        http.perform(post("/api/minutes").header("Authorization",token(admin)).contentType("application/json")
            .content(body(Map.of("title","Synthetic title","content","너를 죽이겠다","meetingDate",LocalDate.now().toString(),"isActive",true))))
            .andExpect(status().isBadRequest());
        http.perform(post("/api/reports").header("Authorization",token(teacher)).contentType("application/json")
            .content(body(Map.of("classGroupId",group.getId(),"reportDate",LocalDate.now().toString(),"specialNotes","너를 죽이겠다"))))
            .andExpect(status().isBadRequest());
        http.perform(post("/api/safety/reports").header("Authorization",token(teacher)).contentType("application/json")
            .content(body(Map.of("targetType","CONTENT","contentType","OTHER","subject","위협 신고","reason","HARASSMENT",
                "details","너를 죽이겠다 라는 말을 들었습니다.","requestId",UUID.randomUUID().toString())))).andExpect(status().isOk());
        assertEquals(0,minutes.count()); assertEquals(0,dailyReports.count());
    }
    @Test void candidateIsPrivateUntilExplicitApprovalAndOldNullResubmissionPreservesIt() throws Exception {
        String candidate=image(0xff0000); updateProfile(candidate); var pending=photo();
        assertNull(users.findById(teacher.getId()).orElseThrow().getProfileImage());
        http.perform(get("/api/users/me/profile").header("Authorization",token(teacher))).andExpect(status().isOk())
            .andExpect(jsonPath("$.profileImage").isEmpty());
        http.perform(get("/api/users/teachers/roster").header("Authorization",token(other))).andExpect(status().isOk())
            .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString(candidate))));
        http.perform(get("/api/safety/admin/photos/"+pending.get("id").asLong()+"/image").header("Authorization",token(teacher))).andExpect(status().isForbidden());
        updateProfile(null); assertEquals(candidate,photos.findById(pending.get("id").asLong()).orElseThrow().getPendingImage());
        review(pending,"APPROVED",pending.get("revision").asLong(),200);
        assertEquals(candidate,users.findById(teacher.getId()).orElseThrow().getProfileImage());
        assertNull(photos.findById(pending.get("id").asLong()).orElseThrow().getPendingImage());
    }
    @Test void replacedCandidateRejectsStaleApprovalAndRejectionKeepsPriorApprovedImage() throws Exception {
        String original=image(0xff0000),replacement=image(0x00ff00),latest=image(0x0000ff);
        updateProfile(original); var first=photo(); review(first,"APPROVED",first.get("revision").asLong(),200);
        updateProfile(replacement); var second=photo(); updateProfile(original); // Old UI saves another field.
        assertEquals(replacement,photos.findById(second.get("id").asLong()).orElseThrow().getPendingImage());
        updateProfile(latest); review(second,"APPROVED",second.get("revision").asLong(),409);
        var third=photo(); review(third,"REJECTED",third.get("revision").asLong(),200);
        assertEquals(original,users.findById(teacher.getId()).orElseThrow().getProfileImage());
        assertEquals(1,photos.count()); assertNull(photos.findById(third.get("id").asLong()).orElseThrow().getPendingImage());
    }
    @Test void explicitDeleteCancelsPendingAndForeignUsersCannotReadStatusOrDelete() throws Exception {
        updateProfile(image(0xff0000)); var pending=photo();
        for(String route:List.of("/api/safety/photos/status","/api/safety/photos")) {
            var req=route.endsWith("status")?get(route):delete(route);
            http.perform(req.header("Authorization",token(other)).param("targetType","USER").param("targetId",teacher.getId().toString()))
                .andExpect(status().isForbidden());
        }
        http.perform(delete("/api/safety/photos").header("Authorization",token(teacher)).param("targetType","USER").param("targetId",teacher.getId().toString()))
            .andExpect(status().isNoContent());
        review(pending,"APPROVED",pending.get("revision").asLong(),409);
        assertNull(users.findById(teacher.getId()).orElseThrow().getProfileImage());
    }
    @Test void malformedExternalAndOversizedPicturesAreRejectedBeforePersistence() throws Exception {
        for(String candidate:List.of("https://example.invalid/image.png","data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,aW52YWxpZA==",
            "data:image/jpeg;base64,"+"A".repeat(2_800_001)))
            http.perform(put("/api/users/me/profile").header("Authorization",token(teacher)).contentType("application/json").content(body(profile(candidate))))
                .andExpect(status().isBadRequest());
        assertEquals(0,photos.count());
    }
    @Test void studentPhotosUseSameQueueAndCannotCrossClassBoundary() throws Exception {
        String candidate=image(0xff0000); var payload=Map.of("name",student.getName(),"profileImage",candidate);
        http.perform(put("/api/students/"+student.getId()).header("Authorization",token(other)).contentType("application/json").content(body(payload)))
            .andExpect(status().isForbidden());
        http.perform(put("/api/students/"+student.getId()).header("Authorization",token(teacher)).contentType("application/json").content(body(payload)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.profileImage").isEmpty());
        var pending=photo(); assertEquals("STUDENT",pending.get("targetType").asText());
        review(pending,"APPROVED",pending.get("revision").asLong(),200); assertEquals(candidate,students.findById(student.getId()).orElseThrow().getProfileImage());
    }
    @Test void hidingDailyNotesKeepsAttendanceAndOriginalForAuthorizedReviewAndCannotBeSilentlyRePublished() throws Exception {
        var daily=dailyReports.saveAndFlush(DailyReport.builder().classGroup(group).teacher(teacher).reportDate(LocalDate.now())
            .specialNotes("Synthetic disputed note").totalStudents(7).presentCount(5).build());
        var reported=report("DAILY_REPORT",daily.getId()); resolve(reported,"REVIEWED",400); resolve(reported,"HIDE_REPORT_NOTES",200);
        assertEquals(7,daily.getTotalStudents()); assertEquals(5,daily.getPresentCount()); assertNull(daily.getSpecialNotes());
        assertEquals("Synthetic disputed note",daily.getModerationNotes());
        http.perform(get("/api/reports/status").header("Authorization",token(teacher)).param("classId",group.getId().toString()).param("date",LocalDate.now().toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.specialNotes").isEmpty()).andExpect(jsonPath("$.moderationNotes").doesNotExist());
        http.perform(get("/api/reports/status").header("Authorization",token(other)).param("classId",group.getId().toString()).param("date",LocalDate.now().toString()))
            .andExpect(status().isForbidden());
        daily.updateCounts(7,5,2,0,"Synthetic disputed note"); assertNull(daily.getSpecialNotes());
        daily.updateCounts(7,5,2,0,null); assertEquals("Synthetic disputed note",daily.getModerationNotes());
        http.perform(get("/api/safety/admin/reports/"+reported.get("id").asLong()+"/target").header("Authorization",token(admin)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.text").value("Synthetic disputed note"));
    }
    @Test void eventAndPhotoProtectionChangeOnlyReportedContentAndRejectWrongTarget() throws Exception {
        var event=events.saveAndFlush(Event.builder().title("Synthetic event").description("Synthetic description").eventDate(LocalDate.now())
            .eventType(Event.EventType.SPECIAL).attendanceRequired(true).build());
        var reported=report("EVENT",event.getId()); resolve(reported,"HIDE_PHOTO",400); resolve(reported,"REDACT_EVENT",200);
        assertEquals("검토로 숨긴 일정",event.getTitle()); assertNull(event.getDescription()); assertTrue(event.isAttendanceRequired());
        assertEquals(LocalDate.now(),event.getEventDate());
        String original=image(0xff0000); teacher.updateProfile(teacher.getName(),null,null,original,null); users.flush();
        var photoReport=report("USER_PROFILE_PHOTO",teacher.getId()); updateProfile(image(0x00ff00));
        resolve(photoReport,"HIDE_PHOTO",200); assertNull(teacher.getProfileImage());
        assertEquals(ModeratedPhoto.Status.HIDDEN,photos.findByTargetTypeAndTargetId(ModeratedPhoto.TargetType.USER,teacher.getId()).orElseThrow().getStatus());
    }
    @Test void queueAssignmentAndDeadlinesArePrivateAndCloseAfterResolution() throws Exception {
        var r=reports.saveAndFlush(ContentReport.builder().reporterId(teacher.getId()).requestId(UUID.randomUUID().toString())
            .targetType(ContentReport.TargetType.CONTENT).contentType(ContentReport.ContentType.OTHER).subject("Synthetic report")
            .reason(ContentReport.Reason.PRIVACY).details("Synthetic details").createdAt(LocalDateTime.now().minusHours(26))
            .dueAt(LocalDateTime.now().minusHours(2)).build());
        http.perform(get("/api/safety/admin/summary").header("Authorization",token(teacher))).andExpect(status().isForbidden());
        http.perform(get("/api/safety/admin/summary").header("Authorization",token(admin))).andExpect(status().isOk()).andExpect(jsonPath("$.overdueCount").value(1));
        var assigned=json.readTree(http.perform(patch("/api/safety/admin/reports/"+r.getId()+"/assignment").header("Authorization",token(admin))
            .contentType("application/json").content(body(Map.of("expectedRevision",r.getRevision(),"urgent",true))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.assignedToId").value(admin.getId())).andExpect(jsonPath("$.urgent").value(true))
            .andReturn().getResponse().getContentAsString());
        resolve(assigned,"REVIEWED",200);
        http.perform(get("/api/safety/admin/summary").header("Authorization",token(admin))).andExpect(status().isOk())
            .andExpect(jsonPath("$.overdueCount").value(0)).andExpect(jsonPath("$.urgentCount").value(0));
        http.perform(get("/api/safety/admin/reports/"+r.getId()+"/target").header("Authorization",token(teacher))).andExpect(status().isForbidden());
    }
}
