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
                INSERT INTO student_memos(id,teacher_id,student_id,sketch) VALUES(1,1,1,'이름 없는 개인 관찰 삭제'),(2,2,1,'다른 교사의 개인 관찰 보존');
                INSERT INTO deactivation_requests(id,student_id,teacher_id,reason,status) VALUES(1,1,1,'학생 전출 확인','PENDING');
                INSERT INTO events(id,title,event_date,event_type,attendance_required,attendance_target) VALUES(1,'가상 행사','2026-10-11','SPECIAL',true,'BOTH');
                UPDATE events SET description='이름 없는 요청자 행사 작성 내용' WHERE id=1;
                INSERT INTO meeting_minutes(id,title,content,meeting_date,is_active,created_at)
                  VALUES(1,'기관 회의록','요청자 개인 문단 / 다른 사람 회의 결정','2026-10-11',true,CURRENT_TIMESTAMP);
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
                INSERT INTO apple_accounts(user_id,subject,refresh_token_ciphertext,revoked_at) VALUES
                  (1,'synthetic.apple.deleted',NULL,CURRENT_TIMESTAMP),(2,'synthetic.apple.preserved','synthetic-encrypted-token',NULL);
                INSERT INTO apple_auth_flows(id,state_hash,nonce_hash,challenge,purpose,stage,expires_at,user_id,subject) VALUES
                  ('22222222-1111-4111-8111-000000000001',repeat('a',64),repeat('a',64),repeat('a',43),'LINK','STARTED',CURRENT_TIMESTAMP+interval '1 hour',1,NULL),
                  ('22222222-1111-4111-8111-000000000002',repeat('b',64),repeat('b',64),repeat('b',43),'LOGIN','REGISTERING',CURRENT_TIMESTAMP+interval '1 hour',NULL,'synthetic.apple.deleted'),
                  ('22222222-1111-4111-8111-000000000003',repeat('c',64),repeat('c',64),repeat('c',43),'LOGIN','REGISTERING',CURRENT_TIMESTAMP+interval '1 hour',NULL,'synthetic.apple.preserved');
                INSERT INTO account_deletion_requests(id,user_id,user_created_at,receipt_token_hash,status,requested_at,target_at,handover_required)
                  VALUES('11111111-1111-4111-8111-111111111111',1,'2026-10-01',repeat('d',64),'REQUESTED',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+interval '7 days',false);
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
            s.execute("INSERT INTO student_memos(id,teacher_id,student_id,sketch) VALUES(3,NULL,1,'가상 원본에서 요청자 작성으로 확인한 과거 익명 메모')");
            // Exercise the production V012/V013 foreign-key actions, absent from Hibernate's scalar IDs.
            s.execute("""
                ALTER TABLE user_status_events ADD FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE;
                ALTER TABLE user_status_events ADD FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL;
                ALTER TABLE user_status_events ADD FOREIGN KEY(report_id) REFERENCES content_reports(id) ON DELETE SET NULL;
                ALTER TABLE moderated_photos ADD FOREIGN KEY(submitted_by) REFERENCES users(id) ON DELETE SET NULL;
                ALTER TABLE moderated_photos ADD FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
                ALTER TABLE content_reports ADD FOREIGN KEY(assigned_to_id) REFERENCES users(id) ON DELETE SET NULL;
                INSERT INTO content_reports(id,revision,reporter_id,request_id,target_type,content_type,target_id,subject,reason,details,status,action,created_at,updated_at)
                  VALUES(4,0,2,'11111111-1111-4111-8111-000000000014','CONTENT','USER_PROFILE_PHOTO',1,'Profile concern','PRIVACY','Remove target picture report','OPEN','NONE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
                UPDATE content_reports SET assigned_to_id=1 WHERE id=3;
                INSERT INTO user_status_events(id,user_id,actor_id,action,reason,report_id,created_at) VALUES
                  (1,1,3,'SUSPEND','Remove own history',2,CURRENT_TIMESTAMP),
                  (2,2,1,'RESTORE','Keep other account history',3,CURRENT_TIMESTAMP),
                  (3,3,2,'RESTORE','Keep history without removed report',4,CURRENT_TIMESTAMP);
                INSERT INTO students(id,name,class_group_id,is_active,profile_image) VALUES(2,'Other synthetic student',1,true,'shared-approved-image');
                INSERT INTO moderated_photos(id,revision,target_type,target_id,pending_image,submitted_by,submitted_at,status,reviewed_by,reviewed_at,review_note) VALUES
                  (1,0,'USER',1,'private-candidate',1,CURRENT_TIMESTAMP,'PENDING',NULL,NULL,NULL),
                  (2,0,'USER',2,'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADElEQVR4XmP4z4AEAA0BAQAPfkcCAAAAAElFTkSuQmCC',2,CURRENT_TIMESTAMP,'PENDING',NULL,NULL,NULL),
                  (3,0,'STUDENT',1,'cancel-authored-candidate',1,CURRENT_TIMESTAMP,'PENDING',NULL,NULL,NULL),
                  (4,0,'STUDENT',2,NULL,1,CURRENT_TIMESTAMP,'APPROVED',1,CURRENT_TIMESTAMP,'Approved synthetic photograph');
                """);

            s.execute("""
                INSERT INTO new_family_members(id,student_id,first_visit,course_json,decision,decision_reason,assignment_requested,memo,handoff_memo,introducer,updated_by,updated_at,revision)
                  VALUES(1,1,'2026-10-11','[null,null,null,null]','REVIEW','',false,'삭제대상가상 상담 / 학생 과정 기록 보존','','','보존교사가상',CURRENT_TIMESTAMP,0);
                INSERT INTO new_family_checks(id,member_id,worship_date,status,updated_by,updated_at)
                  VALUES(1,1,'2026-10-11','PRESENT','삭제대상가상',CURRENT_TIMESTAMP);
                INSERT INTO new_family_submissions(report_date,payload,source_hash,revision,submitted_at,submitted_by)
                  VALUES('2026-10-11','{"present":1,"note":"학생 기록 보존"}',repeat('a',64),1,CURRENT_TIMESTAMP,'삭제대상가상');
                """);
            String inputs=Files.readString(Path.of("db/privacy/request-tables.sql"))
                +"CREATE TEMP TABLE privacy_content_scope ON COMMIT DROP AS "+Files.readString(Path.of("db/privacy/content-scope.sql"))+";";
            String deletion=Files.readString(Path.of("db/privacy/delete-account.sql"));
            String review="""
                INSERT INTO privacy_request VALUES('11111111-1111-4111-8111-111111111111',1,'2026-10-01',true,true,true,true);
                INSERT INTO privacy_legacy_decisions VALUES(1,true);
                INSERT INTO privacy_redactions SELECT 'daily_reports','special_notes',id,md5(special_notes),'학생 기록 보존' FROM daily_reports;
                INSERT INTO privacy_redactions SELECT 'daily_reports_before_class_merge','special_notes',id,md5(special_notes),'학생 기록 보존' FROM daily_reports_before_class_merge;
                INSERT INTO privacy_redactions SELECT 'meeting_minutes','content',id,md5(content),'다른 사람 회의 결정' FROM meeting_minutes;
                INSERT INTO privacy_redactions SELECT 'new_family_members','memo',id,md5(memo),'학생 과정 기록 보존' FROM new_family_members;
                INSERT INTO privacy_redactions SELECT 'new_family_checks','updated_by',id,md5(updated_by),'삭제된 교사' FROM new_family_checks;
                INSERT INTO privacy_redactions SELECT 'new_family_submissions','submitted_by',id,md5(submitted_by),'삭제된 교사' FROM new_family_submissions;
                """+syntheticContentReview()+"UPDATE privacy_content_review SET decision='erase',reason='요청자 단독 작성 내용임을 가상 원본으로 확인함' WHERE (table_name='events' AND column_name='description') OR table_name='student_memos';";
            var original=EventReadMigrationTest.fingerprints(c);
            for(String unsafe:List.of(
                review+"UPDATE privacy_request SET identity_verified=false;",
                review+"UPDATE privacy_request SET expected_created_at='2025-01-01';",
                review+"UPDATE privacy_request SET request_id='22222222-2222-4222-8222-222222222222';",
                review+"UPDATE apple_accounts SET revoked_at=NULL,refresh_token_ciphertext='synthetic-unrevoked' WHERE user_id=1;",
                review+"DELETE FROM privacy_legacy_decisions;",
                review+"DELETE FROM privacy_owned_student_memos;",
                review+"UPDATE student_memos SET sketch='검토 이후 변경' WHERE id=1;",
                review+"DELETE FROM privacy_content_review WHERE table_name='meeting_minutes' AND column_name='content';",
                review+"UPDATE events SET description='검토 이후 새 작성 내용' WHERE id=1;",
                review+"INSERT INTO meeting_minutes(id,title,content,meeting_date,is_active,created_at) VALUES(2,'새 회의','이름 없는 신규 내용','2026-10-12',true,CURRENT_TIMESTAMP);",
                review+"UPDATE privacy_content_review SET decision='retain_other' WHERE table_name='meeting_minutes' AND column_name='content';",
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
            // Restore replay must remain compatible with backups made before V012/V013.
            c.setAutoCommit(false);
            try {
                s.execute("DROP TABLE user_status_events; DROP TABLE moderated_photos; ALTER TABLE content_reports DROP COLUMN assigned_to_id");
                s.execute(inputs+review+namesakeReview); s.execute(deletion);
                assertEquals("0",scalar(c,"SELECT count(*) FROM users WHERE id=1"));
            } finally { c.rollback(); c.setAutoCommit(true); }
            for(String unsafeSafety:List.of(
                "ALTER TABLE events ADD COLUMN unreviewed_photo bigint REFERENCES moderated_photos(id) ON DELETE CASCADE; UPDATE events SET unreviewed_photo=1;",
                "ALTER TABLE events ADD COLUMN unreviewed_history bigint REFERENCES user_status_events(id) ON DELETE CASCADE; UPDATE events SET unreviewed_history=1;",
                "ALTER TABLE user_status_events ADD COLUMN unreviewed_owner bigint REFERENCES users(id) ON DELETE CASCADE;",
                "ALTER TABLE content_reports ADD COLUMN unreviewed_owner bigint REFERENCES users(id) ON DELETE CASCADE;"))
                assertRejectedDeletionRestoresAllRows(c,inputs,review+namesakeReview,deletion,unsafeSafety,"Unreviewed safety lifecycle");
            assertRejectedDeletionRestoresAllRows(c,inputs,review+namesakeReview,deletion,
                "DROP TABLE moderated_photos;","Incomplete photo moderation privacy schema");
            String preservedPhoto=scalar(c,"SELECT to_jsonb(p)::text FROM moderated_photos p WHERE id=2");
            // Production can remain on V010 with notifications disabled: erasure must not require V011.
            assertNull(scalar(c,"SELECT to_regclass('public.apple_notification_subjects')"));
            assertNull(scalar(c,"SELECT to_regclass('public.apple_notification_receipts')"));
            var beforeOptionalNotifications=EventReadMigrationTest.fingerprints(c);
            c.setAutoCommit(false);
            try {
                s.execute(inputs+review+namesakeReview);
                s.execute(deletion);
                assertEquals("0",scalar(c,"SELECT count(*) FROM users WHERE id=1"));
                assertEquals("1",scalar(c,"SELECT count(*) FROM users WHERE id=2"));
                assertEquals("PRESENT",scalar(c,"SELECT status FROM attendances WHERE id=1 AND teacher_id IS NULL"));
                assertEquals("1",scalar(c,"SELECT count(*) FROM apple_accounts WHERE user_id=2"));
            } finally {c.rollback();c.setAutoCommit(true);}
            assertEquals(beforeOptionalNotifications,EventReadMigrationTest.fingerprints(c),"The V011-absent rehearsal must leave every original row intact after rollback");

            // Hibernate created the V010 schema above; apply the real optional V011 SQL, not a test copy.
            s.execute("INSERT INTO schema_migrations(version) VALUES('V010__account_deletion_requests')");
            var beforeV011=EventReadMigrationTest.fingerprints(c);
            s.execute(Files.readString(Path.of("db/migrations/V011__apple_notifications.sql")));
            var afterV011=EventReadMigrationTest.fingerprints(c);
            beforeV011.remove("schema_migrations");afterV011.remove("schema_migrations");
            afterV011.remove("apple_notification_subjects");afterV011.remove("apple_notification_receipts");
            assertEquals(beforeV011,afterV011,"Optional notification migration must preserve all existing rows");
            s.execute("""
                INSERT INTO apple_notification_subjects(subject_hash,user_id,consent_revoked_at,account_deleted_at,grant_started_at,updated_at) VALUES
                  (repeat('a',64),1,100,NULL,90,CURRENT_TIMESTAMP),
                  (repeat('b',64),1,NULL,120,110,CURRENT_TIMESTAMP),
                  (repeat('c',61)||'ada',2,NULL,NULL,130,CURRENT_TIMESTAMP),
                  (repeat('d',64),NULL,140,NULL,NULL,CURRENT_TIMESTAMP);
                INSERT INTO apple_notification_receipts(jti_hash,subject_hash,payload_hash,received_at) VALUES
                  (repeat('1',64),repeat('a',64),repeat('5',64),CURRENT_TIMESTAMP),
                  (repeat('2',64),repeat('b',64),repeat('6',64),CURRENT_TIMESTAMP),
                  (repeat('3',61)||'ada',repeat('c',61)||'ada',repeat('7',61)||'ada',CURRENT_TIMESTAMP),
                  (repeat('4',64),repeat('d',64),repeat('8',64),CURRENT_TIMESTAMP);
                """);
            // Short real names can occur inside unrelated hashes; they must not block erasure.
            s.execute("""
                INSERT INTO users(id,name,email,password,role,is_active,large_font,auth_version,created_at)
                  VALUES(5,'Ada','hash-collision@example.invalid','synthetic','TEACHER',true,false,0,'2026-10-03');
                INSERT INTO apple_notification_subjects(subject_hash,user_id,updated_at)
                  VALUES(repeat('e',64),5,CURRENT_TIMESTAMP);
                INSERT INTO apple_notification_receipts(jti_hash,subject_hash,payload_hash,received_at)
                  VALUES(repeat('9',64),repeat('e',64),repeat('a',64),CURRENT_TIMESTAMP);
                """);
            String collisionReview="INSERT INTO privacy_request VALUES('55555555-5555-4555-8555-555555555555',5,'2026-10-03',true,true,true,true); INSERT INTO privacy_identifiers VALUES('iVB');"+syntheticContentReview();
            // Excluding reviewed hash fields must not exclude a future plaintext field in the same table.
            assertRejectedDeletionRestoresAllRows(c,inputs,collisionReview,deletion,
                "ALTER TABLE apple_notification_subjects ADD COLUMN unreviewed_note text; UPDATE apple_notification_subjects SET unreviewed_note='Ada retained plaintext' WHERE user_id=2;",
                "Retained text needs review");
            String collisionSubjectsSql="SELECT jsonb_agg(to_jsonb(t) ORDER BY subject_hash)::text FROM apple_notification_subjects t WHERE user_id IS DISTINCT FROM 5";
            String collisionReceiptsSql="SELECT jsonb_agg(to_jsonb(t) ORDER BY jti_hash)::text FROM apple_notification_receipts t WHERE subject_hash<>repeat('e',64)";
            String collisionSubjectsBefore=scalar(c,collisionSubjectsSql), collisionReceiptsBefore=scalar(c,collisionReceiptsSql);
            c.setAutoCommit(false);
            try {
                s.execute(inputs+collisionReview);
                s.execute(deletion);
                assertEquals("0",scalar(c,"SELECT count(*) FROM users WHERE id=5"));
                assertEquals("0",scalar(c,"SELECT count(*) FROM apple_notification_subjects WHERE user_id=5"));
                assertEquals("0",scalar(c,"SELECT count(*) FROM apple_notification_receipts WHERE subject_hash=repeat('e',64)"));
                assertEquals(collisionSubjectsBefore,scalar(c,collisionSubjectsSql),"Unrelated subject hashes containing the deleted name must survive unchanged");
                assertEquals(collisionReceiptsBefore,scalar(c,collisionReceiptsSql),"Unrelated receipt and payload hashes containing the deleted name must survive unchanged");
                c.commit();
            } finally {c.rollback();c.setAutoCommit(true);}
            // A retained-text error happens after notification removal and must roll everything back.
            assertRejectedDeletionRestoresAllRows(c,inputs,review+namesakeReview,deletion,
                "UPDATE student_memos SET sketch='subject@example.invalid must be reviewed' WHERE id=2;",
                "Retained text needs review");
            // Even a previously reviewed table may not gain a new cascade into shared data.
            for(String unsafeNotificationForeignKey:List.of(
                "ALTER TABLE events ADD COLUMN notification_owner varchar(64) REFERENCES apple_notification_subjects(subject_hash) ON DELETE CASCADE; UPDATE events SET notification_owner=repeat('a',64);",
                "ALTER TABLE events ADD COLUMN notification_receipt varchar(64) REFERENCES apple_notification_receipts(jti_hash) ON DELETE CASCADE; UPDATE events SET notification_receipt=repeat('1',64);",
                "ALTER TABLE apple_notification_subjects ADD COLUMN unreviewed_owner bigint REFERENCES users(id) ON DELETE CASCADE; UPDATE apple_notification_subjects SET unreviewed_owner=1 WHERE user_id=2;")) {
                assertRejectedDeletionRestoresAllRows(c,inputs,review+namesakeReview,deletion,
                    unsafeNotificationForeignKey,"Unreviewed Apple notification foreign key");
            }
            assertRejectedDeletionRestoresAllRows(c,inputs,review+namesakeReview,deletion,
                "CREATE TABLE unknown_notification_owner(id bigint PRIMARY KEY, subject_hash varchar(64) REFERENCES apple_notification_subjects(subject_hash) ON DELETE CASCADE); INSERT INTO unknown_notification_owner VALUES(1,repeat('a',64));",
                "Unreviewed table");
            assertRejectedDeletionRestoresAllRows(c,inputs,review+namesakeReview,deletion,
                "DROP TABLE apple_notification_receipts;","Incomplete Apple notification privacy schema");
            String preservedNotificationSubjectsSql="SELECT jsonb_agg(to_jsonb(t) ORDER BY subject_hash)::text FROM apple_notification_subjects t WHERE user_id IS DISTINCT FROM 1";
            String preservedNotificationReceiptsSql="SELECT jsonb_agg(to_jsonb(t) ORDER BY jti_hash)::text FROM apple_notification_receipts t WHERE subject_hash IN (SELECT subject_hash FROM apple_notification_subjects WHERE user_id IS DISTINCT FROM 1)";
            String preservedNotificationSubjects=scalar(c,preservedNotificationSubjectsSql);
            String preservedNotificationReceipts=scalar(c,preservedNotificationReceiptsSql);
            String preservedOtherMemo=scalar(c,"SELECT to_jsonb(m)::text FROM student_memos m WHERE id=2");
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
            assertEquals("학생 과정 기록 보존",scalar(c,"SELECT memo FROM new_family_members WHERE id=1"));
            assertEquals("PRESENT",scalar(c,"SELECT status FROM new_family_checks WHERE id=1"));
            assertEquals("삭제된 교사",scalar(c,"SELECT updated_by FROM new_family_checks WHERE id=1"));
            assertEquals("삭제된 교사",scalar(c,"SELECT submitted_by FROM new_family_submissions WHERE report_date='2026-10-11'"));
            assertEquals("1",scalar(c,"SELECT payload::jsonb->>'present' FROM new_family_submissions WHERE report_date='2026-10-11'"));
            assertEquals("1",scalar(c,"SELECT present_count FROM daily_reports"));
            assertEquals("학생 기록 보존",scalar(c,"SELECT special_notes FROM daily_reports_before_class_merge"));
            assertEquals("0",scalar(c,"SELECT count(*) FROM student_memos WHERE id=1"),"Personal author-owned text must be removed even without any identifying string");
            assertEquals(preservedOtherMemo,scalar(c,"SELECT to_jsonb(m)::text FROM student_memos m WHERE id=2"));
            assertEquals("",scalar(c,"SELECT sketch FROM student_memos WHERE id=3"),"An orphaned old memo requires an explicit body decision");
            assertEquals("",scalar(c,"SELECT description FROM events WHERE id=1"));
            assertEquals("가상 행사",scalar(c,"SELECT title FROM events WHERE id=1"));
            assertEquals("다른 사람 회의 결정",scalar(c,"SELECT content FROM meeting_minutes WHERE id=1"));
            assertEquals(1,app.getBean(DailyReportRepository.class).findByDateWithDetails(java.time.LocalDate.of(2026,10,11)).size());
            assertEquals("삭제된 계정",app.getBean(com.newaveflow.service.DeactivationRequestService.class).getPendingRequests().get(0).teacherName());
            assertEquals("2",scalar(c,"SELECT count(*) FROM students"));
            assertEquals("shared-approved-image",scalar(c,"SELECT profile_image FROM students WHERE id=2"));
            assertEquals("0",scalar(c,"SELECT count(*) FROM user_status_events WHERE user_id=1 OR actor_id=1"));
            assertEquals("2",scalar(c,"SELECT count(*) FROM user_status_events"));
            assertNull(scalar(c,"SELECT report_id FROM user_status_events WHERE id=3"));
            assertEquals("2",scalar(c,"SELECT count(*) FROM moderated_photos"));
            assertEquals(preservedPhoto,scalar(c,"SELECT to_jsonb(p)::text FROM moderated_photos p WHERE id=2"));
            assertEquals("1",scalar(c,"SELECT count(*) FROM moderated_photos WHERE id=4 AND submitted_by IS NULL AND reviewed_by IS NULL AND status='APPROVED'"));
            assertEquals("1",scalar(c,"SELECT count(*) FROM kakao_auth_flows"));
            assertEquals("9102",scalar(c,"SELECT kakao_id FROM kakao_auth_flows"));
            assertEquals("1",scalar(c,"SELECT count(*) FROM apple_accounts"));
            assertEquals("synthetic.apple.preserved",scalar(c,"SELECT subject FROM apple_accounts"));
            assertEquals("1",scalar(c,"SELECT count(*) FROM apple_auth_flows"));
            assertEquals("synthetic.apple.preserved",scalar(c,"SELECT subject FROM apple_auth_flows"));
            assertEquals("0",scalar(c,"SELECT count(*) FROM apple_notification_subjects WHERE user_id=1"));
            assertEquals("0",scalar(c,"SELECT count(*) FROM apple_notification_receipts WHERE subject_hash IN (repeat('a',64),repeat('b',64))"));
            assertEquals("2",scalar(c,"SELECT count(*) FROM apple_notification_subjects"));
            assertEquals("2",scalar(c,"SELECT count(*) FROM apple_notification_receipts"));
            assertEquals(preservedNotificationSubjects,scalar(c,preservedNotificationSubjectsSql),"Other accounts and unlinked replay protection must survive unchanged");
            assertEquals(preservedNotificationReceipts,scalar(c,preservedNotificationReceiptsSql),"Other accounts and unlinked event receipts must survive unchanged");
            assertEquals("1",scalar(c,"SELECT count(*) FROM account_deletion_requests WHERE status='COMPLETED' AND user_id IS NULL AND user_created_at IS NULL AND completed_at IS NOT NULL"));
            assertEquals("0",scalar(c,"SELECT count(*) FROM community_agreements"));
            assertEquals("1",scalar(c,"SELECT count(*) FROM content_reports"));
            assertEquals("1",scalar(c,"SELECT count(*) FROM content_reports WHERE moderator_id IS NULL AND assigned_to_id IS NULL AND reporter_id=2"));
            System.out.println("Privacy deletion PASS: verified review, stale/unknown inputs rollback, optional Apple notification schema and cascade guards, shared records, personal history, missing-user authentication, archived authors");
            s.execute("DROP TABLE apple_notification_receipts; DROP TABLE apple_notification_subjects; DROP TABLE daily_reports_before_class_merge; DROP TABLE schema_migrations");
        }
    }
    /** The fixture author knows the provenance of every synthetic field. Production plans
     * start with null decisions and never apply this automatic fixture-only classification. */
    private static String syntheticContentReview() {
        return """
            INSERT INTO privacy_owned_student_memos
              SELECT m.id,md5(to_jsonb(m)::text) FROM student_memos m,privacy_request r WHERE m.teacher_id=r.user_id;
            DO $fixture$
            DECLARE col record;
            BEGIN
              FOR col IN SELECT * FROM privacy_content_scope LOOP
                EXECUTE format('INSERT INTO privacy_content_review SELECT %L,%L,id,md5(%I::text),''retain_other'',''Synthetic provenance confirms another author or institutional record'' FROM public.%I WHERE length(trim(%I::text))>0%s',
                  col.table_name,col.column_name,col.column_name,col.table_name,col.column_name,
                  CASE WHEN col.table_name='student_memos' THEN ' AND teacher_id IS NULL' ELSE '' END);
              END LOOP;
            END $fixture$;
            UPDATE privacy_content_review c SET decision='redact',reason='Synthetic provenance confirms this exact mixed-content replacement'
              FROM privacy_redactions r WHERE c.table_name=r.table_name AND c.column_name=r.column_name AND c.row_id=r.row_id;
            """;
    }
    private static void assertRejectedDeletionRestoresAllRows(Connection c,String inputs,String reviewed,String deletion,String unsafe,String expectedMessage)throws SQLException {
        var before=EventReadMigrationTest.fingerprints(c);
        c.setAutoCommit(false);
        try(var s=c.createStatement()) {
            s.execute(inputs+reviewed+unsafe);
            SQLException failure=assertThrows(SQLException.class,()->s.execute(deletion));
            assertTrue(failure.getMessage().contains(expectedMessage),failure.getMessage());
        } finally {c.rollback();c.setAutoCommit(true);}
        assertEquals(before,EventReadMigrationTest.fingerprints(c),"Rejected deletion must roll back all notification and existing data");
    }
    static String scalar(Connection c,String sql)throws SQLException{return EventReadMigrationTest.scalar(c,sql);}
}
