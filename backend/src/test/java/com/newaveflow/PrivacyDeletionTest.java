package com.newaveflow;

import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.AdminUserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** Destructive rehearsal in an explicitly named, disposable PostgreSQL database only. */
@EnabledIfEnvironmentVariable(named="RUN_PRIVACY_TEST", matches="true")
class PrivacyDeletionTest {
    @Test void reviewedDeletionPreservesSharedDataAndRollsBackEveryUnsafeCase() throws Exception {
        String url=System.getenv("PRIVACY_TEST_JDBC_URL"), user=System.getenv("MIGRATION_TEST_USER"), password=System.getenv("MIGRATION_TEST_PASSWORD");
        assertNotNull(url);
        assertTrue(url.matches("jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/newave_privacy_[a-z0-9_]+"));
        try(var app=new SpringApplicationBuilder(NewaveFlowApplication.class).profiles("prod").run(
            "--server.address=127.0.0.1","--server.port=0","--spring.datasource.url="+url,
            "--spring.datasource.username="+user,"--spring.datasource.password="+password,
            "--spring.jpa.hibernate.ddl-auto=create-drop","--app.seed.enabled=false",
            "--jwt.secret="+UUID.randomUUID()+UUID.randomUUID(),"--spring.main.banner-mode=off","--logging.level.root=ERROR");
            var c=DriverManager.getConnection(url,user,password); var s=c.createStatement()) {
            s.execute("""
                INSERT INTO users(id,name,email,password,role,is_active,large_font,auth_version,created_at) VALUES
                (1,'삭제대상가상','subject@example.invalid','synthetic','TEACHER',true,false,0,'2026-10-01'),
                (2,'보존교사가상','other@example.invalid','synthetic','TEACHER',true,false,0,'2026-10-01'),
                (3,'관리자가상','admin@example.invalid','synthetic','ADMIN',true,false,0,'2026-10-01');
                INSERT INTO class_groups(id,name) VALUES(1,'가상 공동반');
                INSERT INTO teacher_classes(id,teacher_id,class_group_id,is_primary) VALUES(1,1,1,true),(2,2,1,false);
                INSERT INTO students(id,name,class_group_id,is_active) VALUES(1,'가상 학생',1,true);
                INSERT INTO attendances(id,teacher_id,student_id,class_group_id,attendance_date,status) VALUES(1,1,1,1,'2026-10-11','PRESENT');
                INSERT INTO daily_reports(id,teacher_id,class_group_id,report_date,status,total_students,present_count,absent_count,late_count,special_notes)
                  VALUES(1,1,1,'2026-10-11','SUBMITTED',1,1,0,0,'삭제대상가상 연락 완료 / 학생 기록 보존');
                CREATE TABLE daily_reports_before_class_merge AS TABLE daily_reports;
                INSERT INTO student_memos(id,teacher_id,student_id,sketch) VALUES(1,1,1,'학생 관찰 보존');
                INSERT INTO deactivation_requests(id,student_id,teacher_id,reason,status) VALUES(1,1,1,'학생 전출 확인','PENDING');
                INSERT INTO events(id,title,event_date,event_type,attendance_required,attendance_target) VALUES(1,'가상 행사','2026-10-11','SPECIAL',true,'BOTH');
                INSERT INTO event_attendances(id,event_id,teacher_id,status) VALUES(1,1,1,'PRESENT');
                INSERT INTO event_student_attendances(id,event_id,student_id,teacher_id,status) VALUES(1,1,1,1,'PRESENT');
                INSERT INTO event_participants(id,event_id,kind,person_id,name,captured_at) VALUES(1,1,'TEACHER',1,'삭제대상가상','2026-10-01'),(2,1,'STUDENT',1,'가상 학생','2026-10-01');
                INSERT INTO tts_item(id,title,q_type,is_active,points) VALUES(1,'가상 말씀','DAYS',true,5);
                INSERT INTO tts_data_entry(id,teacher_id,info_year,week_num,is_submitted) VALUES(1,1,2026,42,true),(2,2,2026,42,true);
                INSERT INTO tts_answers(id,record_id,question_id,answer_data) VALUES(1,1,1,'{}'),(2,2,1,'{}');
                INSERT INTO tts_legacy_score(id,name,info_year,week_num,score) VALUES(1,'삭제대상가상',2026,40,50),(2,'보존교사가상',2026,40,60);
                INSERT INTO completed_operations(id,actor_id,operation_key,fingerprint,result_json,completed_at) VALUES(1,1,'fixture','fixture','{}','2026-10-01');
                UPDATE users SET kakao_id='9101' WHERE id=1;
                UPDATE users SET kakao_id='9102' WHERE id=2;
                INSERT INTO kakao_auth_flows(id,state_hash,challenge,purpose,stage,native_client,expires_at,user_id,kakao_id) VALUES
                  ('11111111-1111-4111-8111-000000000001',repeat('a',64),repeat('a',43),'LINK','STARTED',false,CURRENT_TIMESTAMP+interval '1 hour',1,NULL),
                  ('11111111-1111-4111-8111-000000000002',repeat('b',64),repeat('b',43),'LOGIN','AUTHORIZED',false,CURRENT_TIMESTAMP+interval '1 hour',NULL,'9101'),
                  ('11111111-1111-4111-8111-000000000003',repeat('c',64),repeat('c',43),'LOGIN','AUTHORIZED',false,CURRENT_TIMESTAMP+interval '1 hour',NULL,'9102');
                """);
            // Recreate old constraints then validate the actual additive migration, including rollback.
            s.execute("INSERT INTO community_agreements(user_id,policy_version,accepted_at) VALUES(1,'2026-10-14-v1',CURRENT_TIMESTAMP)");
            s.execute("""
                INSERT INTO content_reports(id,revision,reporter_id,request_id,target_type,content_type,target_id,subject,reason,details,status,action,moderator_id,created_at,updated_at) VALUES
                (1,0,1,'11111111-1111-4111-8111-000000000011','CONTENT','OTHER',NULL,'Own synthetic safety report','PRIVACY','Remove with reporter','OPEN','NONE',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
                (2,0,2,'11111111-1111-4111-8111-000000000012','USER',NULL,1,'Reported synthetic account','PRIVACY','Remove with reported account','OPEN','NONE',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
                (3,0,2,'11111111-1111-4111-8111-000000000013','CONTENT','OTHER',NULL,'Preserved synthetic safety report','PRIVACY','Retain other content; anonymize moderator','RESOLVED','REVIEWED',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
                """);
            for(String t:List.of("attendances","daily_reports","student_memos","deactivation_requests")) s.execute("ALTER TABLE "+t+" ALTER COLUMN teacher_id SET NOT NULL");
            s.execute("CREATE TABLE schema_migrations(version varchar(80) PRIMARY KEY,applied_at timestamp DEFAULT CURRENT_TIMESTAMP)");
            var before=EventReadMigrationTest.fingerprints(c);
            String migration=Files.readString(Path.of("db/migrations/V004__nullable_shared_record_authors.sql"));
            assertThrows(SQLException.class,()->s.execute(migration.replace("INSERT INTO schema_migrations","SELECT 1/0; INSERT INTO schema_migrations")));
            s.execute("ROLLBACK"); assertEquals(before,EventReadMigrationTest.fingerprints(c));
            s.execute(migration);
            var afterMigration=EventReadMigrationTest.fingerprints(c); afterMigration.remove("schema_migrations");before.remove("schema_migrations");assertEquals(before,afterMigration);

            String inputs=Files.readString(Path.of("db/privacy/request-tables.sql"));
            String deletion=Files.readString(Path.of("db/privacy/delete-account.sql"));
            String review="""
                INSERT INTO privacy_request VALUES('11111111-1111-4111-8111-111111111111',1,'2026-10-01',true,true,true,true);
                INSERT INTO privacy_legacy_decisions VALUES(1,true);
                INSERT INTO privacy_redactions SELECT 'daily_reports','special_notes',id,md5(special_notes),'학생 기록 보존' FROM daily_reports;
                INSERT INTO privacy_redactions SELECT 'daily_reports_before_class_merge','special_notes',id,md5(special_notes),'학생 기록 보존' FROM daily_reports_before_class_merge;
                """;
            var original=EventReadMigrationTest.fingerprints(c);
            for(String unsafe:List.of(
                review+"UPDATE privacy_request SET identity_verified=false;",
                review+"UPDATE privacy_request SET expected_created_at='2025-01-01';",
                review+"DELETE FROM privacy_legacy_decisions;",
                review+"DELETE FROM privacy_redactions;",
                review+"UPDATE privacy_redactions SET before_md5='stale';")) {
                c.setAutoCommit(false);
                try { s.execute(inputs+unsafe); assertThrows(SQLException.class,()->s.execute(deletion)); }
                finally {c.rollback();c.setAutoCommit(true);}
                assertEquals(original,EventReadMigrationTest.fingerprints(c));
            }
            // An unrecognized user FK must abort instead of cascading into shared data.
            s.execute("CREATE TABLE unknown_owner(id bigint PRIMARY KEY, user_id bigint REFERENCES users(id)); INSERT INTO unknown_owner VALUES(1,1)");
            c.setAutoCommit(false);
            try{s.execute(inputs+review);assertThrows(SQLException.class,()->s.execute(deletion));}finally{c.rollback();c.setAutoCommit(true);}
            assertEquals("1",scalar(c,"SELECT count(*) FROM users WHERE id=1"));s.execute("DROP TABLE unknown_owner");
            // Last administrator protection.
            c.setAutoCommit(false);
            try{s.execute(inputs+review+"UPDATE privacy_request SET user_id=3;");assertThrows(SQLException.class,()->s.execute(deletion));}finally{c.rollback();c.setAutoCommit(true);}
            // Namesakes must survive, and keeping matching text requires a row-bound review exception.
            s.execute("INSERT INTO users(id,name,email,password,role,is_active,large_font,auth_version,created_at) VALUES(4,'삭제대상가상','namesake@example.invalid','synthetic','TEACHER',true,false,0,'2026-10-02')");
            s.execute("INSERT INTO tts_legacy_score(id,name,info_year,week_num,score) VALUES(3,'삭제대상가상',2026,41,70)");
            c.setAutoCommit(false);
            try{s.execute(inputs+review);assertThrows(SQLException.class,()->s.execute(deletion));}finally{c.rollback();c.setAutoCommit(true);}
            String namesakeReview="""
                INSERT INTO privacy_legacy_decisions VALUES(3,false);
                INSERT INTO privacy_exceptions VALUES('users','name',4,md5('삭제대상가상'),'별도로 본인 확인한 동명이인 계정 보존');
                INSERT INTO privacy_exceptions VALUES('tts_legacy_score','name',3,md5('삭제대상가상'),'원본 대조로 다른 교사의 점수임을 확인');
                """;
            var userRepo=app.getBean(UserRepository.class);
            assertTrue(userRepo.findById(1L).isPresent());
            var tokens=app.getBean(JwtTokenProvider.class);
            String access=tokens.createAccessToken(1L,"subject@example.invalid","TEACHER");
            String refresh=tokens.createRefreshToken(1L,"subject@example.invalid","TEACHER");
            int port=((org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext)app).getWebServer().getPort();
            var http=java.net.http.HttpClient.newHttpClient();
            var me=java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://127.0.0.1:"+port+"/api/users/me")).header("Authorization","Bearer "+access).GET().build();
            assertEquals(200,http.send(me,java.net.http.HttpResponse.BodyHandlers.discarding()).statusCode());
            c.setAutoCommit(false);s.execute(inputs+review+namesakeReview);s.execute(deletion);c.commit();c.setAutoCommit(true);
            assertTrue(userRepo.findById(1L).isEmpty(),"JWT/refresh both require an existing user row");
            assertEquals(401,http.send(me,java.net.http.HttpResponse.BodyHandlers.discarding()).statusCode());
            assertThrows(com.newaveflow.exception.AppException.class,()->app.getBean(com.newaveflow.service.AuthService.class).refresh(refresh));
            assertTrue(app.getBean(AdminUserService.class).getPendingUsers().stream().noneMatch(u->u.id().equals(1L)));
            assertEquals("1",scalar(c,"SELECT count(*) FROM tts_answers"));
            assertEquals("1",scalar(c,"SELECT count(*) FROM tts_legacy_score WHERE id=2"));
            assertEquals("1",scalar(c,"SELECT count(*) FROM tts_legacy_score WHERE id=3"));
            assertEquals("삭제대상가상",scalar(c,"SELECT name FROM users WHERE id=4"));
            assertEquals("0",scalar(c,"SELECT count(*) FROM event_attendances"));
            assertEquals("0",scalar(c,"SELECT count(*) FROM event_participants WHERE kind='TEACHER'"));
            assertEquals("1",scalar(c,"SELECT count(*) FROM event_participants WHERE kind='STUDENT'"));
            assertEquals("PRESENT",scalar(c,"SELECT status FROM event_student_attendances WHERE id=1 AND teacher_id IS NULL"));
            assertEquals("SUBMITTED",scalar(c,"SELECT status FROM daily_reports WHERE teacher_id IS NULL"));
            assertEquals("1",scalar(c,"SELECT present_count FROM daily_reports"));
            assertEquals("학생 기록 보존",scalar(c,"SELECT special_notes FROM daily_reports_before_class_merge"));
            assertEquals(1,app.getBean(DailyReportRepository.class).findByDateWithDetails(java.time.LocalDate.of(2026,10,11)).size());
            assertEquals("삭제된 계정",app.getBean(com.newaveflow.service.DeactivationRequestService.class).getPendingRequests().get(0).teacherName());
            assertEquals("1",scalar(c,"SELECT count(*) FROM students"));
            assertEquals("1",scalar(c,"SELECT count(*) FROM kakao_auth_flows"));
            assertEquals("9102",scalar(c,"SELECT kakao_id FROM kakao_auth_flows"));
            assertEquals("0",scalar(c,"SELECT count(*) FROM community_agreements"));
            assertEquals("1",scalar(c,"SELECT count(*) FROM content_reports"));
            assertEquals("1",scalar(c,"SELECT count(*) FROM content_reports WHERE moderator_id IS NULL AND reporter_id=2"));
            System.out.println("Privacy deletion PASS: verified review, stale/unknown inputs rollback, shared records, personal history, missing-user authentication, archived authors");
            s.execute("DROP TABLE daily_reports_before_class_merge; DROP TABLE schema_migrations");
        }
    }
    static String scalar(Connection c,String sql)throws SQLException{return EventReadMigrationTest.scalar(c,sql);}
}
