package com.newaveflow;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="RUN_WEEKLY_REPORT_MIGRATION",matches="true")
class WeeklyReportMigrationTest {
    @Test void migrationRollsBackPreservesLegacyReportsAndMatchesJpa()throws Exception {
        String url=System.getenv("WEEKLY_REPORT_TEST_JDBC_URL"),user=System.getenv("MIGRATION_TEST_USER"),password=System.getenv("MIGRATION_TEST_PASSWORD");
        assertNotNull(url);assertTrue(url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/newave_weekly_[a-z0-9_]+"));
        try(var app=application(url,user,password,"create")){assertTrue(app.isActive());}
        try(var c=DriverManager.getConnection(url,user,password);var s=c.createStatement()) {
            s.execute("DROP TABLE weekly_class_supplements,teacher_worship_attendances,weekly_department_reports,weekly_report_exports");
            s.execute("ALTER TABLE daily_reports DROP COLUMN submitted_data,DROP COLUMN submission_revision,DROP COLUMN draft_changed,DROP COLUMN correction_reason");
            s.execute("ALTER TABLE users DROP COLUMN gender");
            s.execute("CREATE TABLE schema_migrations(version varchar(80) PRIMARY KEY,applied_at timestamp DEFAULT CURRENT_TIMESTAMP)");
            s.execute("INSERT INTO schema_migrations(version) VALUES('V016__tts_calendar_quarters')");
            s.execute("INSERT INTO class_groups(id,name,age_group) VALUES(901,'Synthetic report class','중1')");
            s.execute("INSERT INTO daily_reports(id,class_group_id,report_date,status,total_students,present_count,absent_count,late_count,special_notes) VALUES(901,901,'2026-10-25','SUBMITTED',3,2,1,0,'Keep original shared notes')");
            String sql=Files.readString(Path.of("db/migrations/V017__weekly_church_reports.sql"));
            var before=EventReadMigrationTest.fingerprints(c);
            assertThrows(SQLException.class,()->s.execute(sql.replace("INSERT INTO schema_migrations","SELECT 1/0; INSERT INTO schema_migrations")));
            s.execute("ROLLBACK");assertEquals(before,EventReadMigrationTest.fingerprints(c));
            s.execute(sql);
            s.execute("INSERT INTO users(id,name,email,role,is_active,is_suspended,auth_version,large_font) VALUES(902,'Synthetic teacher','migration-profile@example.invalid','TEACHER',true,false,0,false)");
            s.execute("INSERT INTO teacher_worship_attendances(teacher_id,worship_date,gender,status) VALUES(902,'2026-10-25','여','PRESENT')");
            String profileSql=Files.readString(Path.of("db/migrations/V018__teacher_profile_gender.sql"));
            var beforeProfile=EventReadMigrationTest.fingerprints(c);
            assertThrows(SQLException.class,()->s.execute(profileSql.replace("INSERT INTO schema_migrations","SELECT 1/0; INSERT INTO schema_migrations")));
            s.execute("ROLLBACK");assertEquals(beforeProfile,EventReadMigrationTest.fingerprints(c));
            s.execute(profileSql);
            assertEquals("여",EventReadMigrationTest.scalar(c,"SELECT gender FROM users WHERE id=902"));
            s.execute("INSERT INTO teacher_worship_attendances(teacher_id,worship_date,gender,status) VALUES(902,'2026-10-18','','PRESENT')");
            assertThrows(SQLException.class,()->s.execute("UPDATE users SET gender='invalid' WHERE id=902"));
            assertThrows(SQLException.class,()->s.execute(profileSql));s.execute("ROLLBACK");
            assertEquals("Keep original shared notes",EventReadMigrationTest.scalar(c,"SELECT special_notes FROM daily_reports WHERE id=901"));
            assertEquals("2",EventReadMigrationTest.scalar(c,"SELECT present_count FROM daily_reports WHERE id=901"));
            assertEquals("0",EventReadMigrationTest.scalar(c,"SELECT submission_revision FROM daily_reports WHERE id=901"));
            assertThrows(SQLException.class,()->s.execute(sql));s.execute("ROLLBACK");
            s.execute("INSERT INTO weekly_department_reports(report_date,fields_json) VALUES('2026-10-25','{}')");
            assertThrows(SQLException.class,()->s.execute("INSERT INTO weekly_department_reports(report_date,fields_json) VALUES('2026-10-25','{}')"));
        }
        try(var app=application(url,user,password,"validate")){assertTrue(app.isActive());}
    }
    private org.springframework.context.ConfigurableApplicationContext application(String url,String user,String password,String ddl){
        return new SpringApplicationBuilder(NewaveFlowApplication.class).profiles("prod").run("--server.address=127.0.0.1","--server.port=0","--spring.datasource.url="+url,"--spring.datasource.username="+user,"--spring.datasource.password="+password,"--spring.jpa.hibernate.ddl-auto="+ddl,"--app.seed.enabled=false","--kakao.enabled=false","--jwt.secret="+UUID.randomUUID()+UUID.randomUUID(),"--spring.main.banner-mode=off","--logging.level.root=ERROR");
    }
}
