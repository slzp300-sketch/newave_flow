package com.newaveflow;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** A named, local, synthetic database only. No production data or credentials. */
@EnabledIfEnvironmentVariable(named="RUN_SUSPENSION_MIGRATION", matches="true")
class UserSuspensionMigrationTest {
    @Test void backfillUsesPositiveEvidencePreservesAmbiguityAndRunsWithoutOptionalAppleMigration() throws Exception {
        String url=System.getenv("SUSPENSION_TEST_JDBC_URL"), user=System.getenv("MIGRATION_TEST_USER"), password=System.getenv("MIGRATION_TEST_PASSWORD");
        assertNotNull(url);
        assertTrue(url.matches("jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/newave_suspension_[a-z0-9_]+"));
        try(var app=application(url,user,password,"create")) { assertTrue(app.isActive()); }
        try(var c=DriverManager.getConnection(url,user,password); var s=c.createStatement()) {
            s.execute("DROP TABLE user_status_events; ALTER TABLE users DROP COLUMN is_suspended; ALTER TABLE users DROP COLUMN suspended_at");
            s.execute("CREATE TABLE IF NOT EXISTS schema_migrations(version varchar(80) PRIMARY KEY,applied_at timestamp DEFAULT CURRENT_TIMESTAMP)");
            s.execute("INSERT INTO schema_migrations(version) VALUES('V010__account_deletion_requests')");
            s.execute("INSERT INTO users(id,name,email,password,role,is_active,large_font,auth_version) VALUES"
                +"(901,'Synthetic moderator','suspension-admin@example.invalid','synthetic','ADMIN',true,false,4),"
                +"(902,'Synthetic restricted','suspension-restricted@example.invalid','synthetic','TEACHER',false,false,5),"
                +"(903,'Synthetic inactive unknown','suspension-unknown@example.invalid','synthetic','TEACHER',false,false,0),"
                +"(904,'Synthetic active old report','suspension-active@example.invalid','synthetic','TEACHER',true,false,7)");
            for(int id:List.of(902,904)) s.execute("INSERT INTO content_reports(revision,reporter_id,request_id,target_type,target_id,subject,reason,details,status,action,moderator_id,created_at,updated_at,resolved_at) VALUES"
                +"(0,901,'00000000-0000-4000-8000-000000000"+id+"','USER',"+id+",'Synthetic subject','HARASSMENT','Synthetic only','RESOLVED','SUSPEND_USER',901,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
            String before=scalar(c,"SELECT md5(string_agg(to_jsonb(u)::text,',' ORDER BY id)) FROM users u");
            String reportsBefore=scalar(c,"SELECT md5(string_agg(to_jsonb(r)::text,',' ORDER BY id)) FROM content_reports r");
            String sql=Files.readString(Path.of("db/migrations/V012__user_suspension.sql"));
            assertThrows(SQLException.class,()->s.execute(sql.replace("INSERT INTO schema_migrations", "SELECT 1/0; INSERT INTO schema_migrations")));
            s.execute("ROLLBACK");
            assertEquals(before,scalar(c,"SELECT md5(string_agg(to_jsonb(u)::text,',' ORDER BY id)) FROM users u"));
            assertNull(scalar(c,"SELECT to_regclass('public.user_status_events')"));
            s.execute(sql);
            assertEquals(before,scalar(c,"SELECT md5(string_agg((to_jsonb(u)-'is_suspended'-'suspended_at')::text,',' ORDER BY id)) FROM users u"));
            assertEquals(reportsBefore,scalar(c,"SELECT md5(string_agg(to_jsonb(r)::text,',' ORDER BY id)) FROM content_reports r"));
            assertEquals("true",scalar(c,"SELECT is_suspended::text FROM users WHERE id=902"));
            assertEquals("false",scalar(c,"SELECT is_suspended::text FROM users WHERE id=903"));
            assertEquals("false",scalar(c,"SELECT is_suspended::text FROM users WHERE id=904"));
            assertEquals("1",scalar(c,"SELECT count(*) FROM user_status_events"));
            assertEquals("LEGACY_SUSPEND",scalar(c,"SELECT action FROM user_status_events"));
            assertEquals("0",scalar(c,"SELECT count(*) FROM schema_migrations WHERE version='V011__apple_notifications'"));
            assertThrows(SQLException.class,()->s.execute(sql)); s.execute("ROLLBACK");
            assertThrows(SQLException.class,()->s.execute("UPDATE users SET is_active=true WHERE id=902"));
            s.execute("DELETE FROM content_reports WHERE target_id=902");
            assertNull(scalar(c,"SELECT report_id FROM user_status_events WHERE user_id=902"));
            s.execute("DELETE FROM content_reports WHERE reporter_id=901; DELETE FROM users WHERE id=901");
            assertNull(scalar(c,"SELECT actor_id FROM user_status_events WHERE user_id=902"));
            s.execute("DELETE FROM users WHERE id=902");
            assertEquals("0",scalar(c,"SELECT count(*) FROM user_status_events"));
        }
        try(var app=application(url,user,password,"validate")) { assertTrue(app.isActive()); }
    }
    private String scalar(Connection c,String sql) throws SQLException {
        try(var s=c.createStatement();var r=s.executeQuery(sql)) { assertTrue(r.next()); return r.getString(1); }
    }
    private org.springframework.context.ConfigurableApplicationContext application(String url,String user,String password,String ddl) {
        return new SpringApplicationBuilder(NewaveFlowApplication.class).profiles("prod").run(
            "--server.address=127.0.0.1","--server.port=0","--spring.datasource.url="+url,"--spring.datasource.username="+user,"--spring.datasource.password="+password,
            "--spring.jpa.hibernate.ddl-auto="+ddl,"--jwt.secret="+UUID.randomUUID()+UUID.randomUUID(),"--app.seed.enabled=false","--kakao.enabled=false",
            "--spring.main.banner-mode=off","--logging.level.root=ERROR");
    }
}
