package com.newaveflow;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** Only disposable synthetic databases; no production credentials or records. */
@EnabledIfEnvironmentVariable(named="RUN_COMMUNITY_MIGRATION", matches="true")
class CommunitySafetyMigrationTest {
    @Test void additiveMigrationRollsBackPreservesEveryExistingRowAndValidatesProductionSchema() throws Exception {
        String url=System.getenv("COMMUNITY_TEST_JDBC_URL"), user=System.getenv("MIGRATION_TEST_USER"), password=System.getenv("MIGRATION_TEST_PASSWORD");
        assertNotNull(url);
        assertTrue(url.matches("jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/newave_community_[a-z0-9_]+"));
        try(var app=application(url,user,password,"create")) { assertTrue(app.isActive()); }
        try(var c=DriverManager.getConnection(url,user,password); var s=c.createStatement()) {
            s.execute("DROP TABLE content_reports; DROP TABLE community_agreements");
            s.execute("DROP TABLE IF EXISTS schema_migrations");
            s.execute("CREATE TABLE schema_migrations(version varchar(80) PRIMARY KEY,applied_at timestamp DEFAULT CURRENT_TIMESTAMP)");
            s.execute("INSERT INTO users(id,name,email,password,role,is_active,large_font,auth_version) VALUES(901,'Synthetic safety account','community@example.invalid','synthetic','TEACHER',true,false,0)");
            s.execute("INSERT INTO class_groups(id,name) VALUES(901,'Synthetic safety class')");
            s.execute("INSERT INTO daily_reports(id,class_group_id,teacher_id,report_date,status,total_students,present_count,absent_count,late_count,special_notes) VALUES(901,901,901,'2026-10-11','SUBMITTED',2,2,0,0,'Preserve shared notes')");
            String sql=Files.readString(Path.of("db/migrations/V008__community_safety.sql"));
            var before=EventReadMigrationTest.fingerprints(c);
            assertThrows(SQLException.class,()->s.execute(sql.replace("INSERT INTO schema_migrations","SELECT 1/0; INSERT INTO schema_migrations")));
            s.execute("ROLLBACK"); assertEquals(before,EventReadMigrationTest.fingerprints(c));
            s.execute(sql);
            var after=EventReadMigrationTest.fingerprints(c);
            after.remove("community_agreements"); after.remove("content_reports"); after.remove("schema_migrations"); before.remove("schema_migrations");
            assertEquals(before,after);
            assertThrows(SQLException.class,()->s.execute(sql)); s.execute("ROLLBACK");
            s.execute("INSERT INTO community_agreements VALUES(901,'2026-10-14-v1',CURRENT_TIMESTAMP)");
            s.execute("INSERT INTO content_reports(reporter_id,request_id,target_type,content_type,subject,reason,details,status,action,created_at,updated_at,resolved_at) VALUES(901,'11111111-1111-4111-8111-111111111111','CONTENT','OTHER','Synthetic','PRIVACY','Keep closed until retention expires','RESOLVED','REVIEWED',CURRENT_TIMESTAMP-interval '92 days',CURRENT_TIMESTAMP-interval '91 days',CURRENT_TIMESTAMP-interval '91 days')");
            s.execute("INSERT INTO content_reports(reporter_id,request_id,target_type,content_type,subject,reason,details,status,action,created_at,updated_at) VALUES(901,'22222222-2222-4222-8222-222222222222','CONTENT','OTHER','Synthetic open','PRIVACY','Preserve open report','OPEN','NONE',CURRENT_TIMESTAMP-interval '100 days',CURRENT_TIMESTAMP)");
            s.execute(Files.readString(Path.of("db/privacy/purge-resolved-content-reports.sql")));
            assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM content_reports"));
            assertEquals("OPEN",EventReadMigrationTest.scalar(c,"SELECT status FROM content_reports"));
            assertEquals("Preserve shared notes",EventReadMigrationTest.scalar(c,"SELECT special_notes FROM daily_reports WHERE id=901"));
        }
        try(var app=application(url,user,password,"validate")) { assertTrue(app.isActive()); }
    }
    private org.springframework.context.ConfigurableApplicationContext application(String url,String user,String password,String ddl) {
        return new SpringApplicationBuilder(NewaveFlowApplication.class).profiles("prod").run(
            "--server.address=127.0.0.1","--server.port=0","--spring.datasource.url="+url,"--spring.datasource.username="+user,"--spring.datasource.password="+password,
            "--spring.jpa.hibernate.ddl-auto="+ddl,"--jwt.secret="+UUID.randomUUID()+UUID.randomUUID(),"--app.seed.enabled=false","--kakao.enabled=false",
            "--spring.main.banner-mode=off","--logging.level.root=ERROR");
    }
}
