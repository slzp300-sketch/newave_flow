package com.newaveflow;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** Only an explicitly named loopback disposable PostgreSQL database, with synthetic records. */
@EnabledIfEnvironmentVariable(named="RUN_CONTENT_MODERATION_MIGRATION",matches="true")
class ContentModerationMigrationTest {
    @Test void additiveMigrationIsAtomicAndCompatibleWithOldWritesWithoutOptionalAppleSchema() throws Exception {
        String url=System.getenv("CONTENT_MODERATION_TEST_JDBC_URL"),user=System.getenv("MIGRATION_TEST_USER"),password=System.getenv("MIGRATION_TEST_PASSWORD");
        assertNotNull(url);
        assertTrue(url.matches("jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/newave_moderation_[a-z0-9_]+"));
        try(var app=application(url,user,password,"create")) { assertTrue(app.isActive()); }
        try(var c=DriverManager.getConnection(url,user,password);var s=c.createStatement()) {
            s.execute("DROP TABLE moderated_photos; ALTER TABLE daily_reports DROP COLUMN notes_hidden; DROP TABLE content_reports; DROP TABLE community_agreements");
            s.execute("DROP TABLE IF EXISTS schema_migrations; CREATE TABLE schema_migrations(version varchar(80) PRIMARY KEY,applied_at timestamp DEFAULT CURRENT_TIMESTAMP)");
            s.execute(Files.readString(Path.of("db/migrations/V008__community_safety.sql")));
            s.execute("INSERT INTO schema_migrations(version) VALUES('V010__account_deletion_requests')");
            s.execute("INSERT INTO users(id,name,email,password,role,is_active,large_font,auth_version,is_suspended) VALUES(901,'Synthetic moderation account','moderation@example.invalid','synthetic','TEACHER',true,false,0,false)");
            s.execute("INSERT INTO class_groups(id,name) VALUES(901,'Synthetic moderation class')");
            s.execute("INSERT INTO daily_reports(id,class_group_id,teacher_id,report_date,status,total_students,present_count,absent_count,late_count,special_notes) VALUES(901,901,901,'2026-10-11','SUBMITTED',5,3,1,1,'Preserve shared notes')");
            String oldReportInsert="INSERT INTO content_reports(reporter_id,request_id,target_type,content_type,subject,reason,details,status,action,created_at,updated_at) VALUES(901,'%s','CONTENT','OTHER','Synthetic concern','PRIVACY','Preserve synthetic detail','OPEN','NONE',CURRENT_TIMESTAMP-INTERVAL '3 days',CURRENT_TIMESTAMP)";
            s.execute(oldReportInsert.formatted("11111111-1111-4111-8111-111111111111"));
            String sql=Files.readString(Path.of("db/migrations/V013__content_moderation.sql"));
            var before=EventReadMigrationTest.fingerprints(c);
            assertThrows(SQLException.class,()->s.execute(sql.replace("INSERT INTO schema_migrations","SELECT 1/0; INSERT INTO schema_migrations")));
            s.execute("ROLLBACK"); assertEquals(before,EventReadMigrationTest.fingerprints(c));
            s.execute(sql);
            assertEquals("0",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM schema_migrations WHERE version LIKE 'V011%';"));
            assertEquals("Preserve shared notes",EventReadMigrationTest.scalar(c,"SELECT special_notes FROM daily_reports WHERE id=901"));
            assertEquals("5:3:1:1:false",EventReadMigrationTest.scalar(c,"SELECT concat(total_students,':',present_count,':',absent_count,':',late_count,':',notes_hidden::text) FROM daily_reports WHERE id=901"));
            assertEquals("true",EventReadMigrationTest.scalar(c,"SELECT (due_at=created_at+INTERVAL '24 hours')::text FROM content_reports LIMIT 1"));
            // A still-running previous server omits the additive columns; inserts must remain valid.
            s.execute(oldReportInsert.formatted("22222222-2222-4222-8222-222222222222"));
            assertEquals("2",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM content_reports WHERE due_at IS NOT NULL AND urgent=false AND assigned_to_id IS NULL"));
            s.execute("INSERT INTO moderated_photos(target_type,target_id,pending_image,submitted_by,submitted_at,status) VALUES('USER',901,'synthetic-image',901,CURRENT_TIMESTAMP,'PENDING')");
            assertThrows(SQLException.class,()->s.execute("INSERT INTO moderated_photos(target_type,target_id,pending_image,submitted_at,status) VALUES('USER',902,NULL,CURRENT_TIMESTAMP,'PENDING')"));
            assertThrows(SQLException.class,()->s.execute("INSERT INTO moderated_photos(target_type,target_id,pending_image,submitted_at,status) VALUES('USER',901,'duplicate',CURRENT_TIMESTAMP,'PENDING')"));
            assertThrows(SQLException.class,()->s.execute(sql)); s.execute("ROLLBACK");
            assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM moderated_photos"));
        }
        try(var app=application(url,user,password,"validate")) { assertTrue(app.isActive()); }
    }
    private org.springframework.context.ConfigurableApplicationContext application(String url,String user,String password,String ddl) {
        return new SpringApplicationBuilder(NewaveFlowApplication.class).profiles("prod").run(
            "--server.address=127.0.0.1","--server.port=0","--spring.datasource.url="+url,"--spring.datasource.username="+user,"--spring.datasource.password="+password,
            "--spring.jpa.hibernate.ddl-auto="+ddl,"--jwt.secret="+UUID.randomUUID()+UUID.randomUUID(),"--app.seed.enabled=false","--kakao.enabled=false",
            "--apple.enabled=false","--apple.notifications-enabled=false","--spring.main.banner-mode=off","--logging.level.root=ERROR");
    }
}
