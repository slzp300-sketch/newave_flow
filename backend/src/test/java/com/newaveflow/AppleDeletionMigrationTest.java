package com.newaveflow;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** Uses a fresh disposable local database only. Never receives production records or credentials. */
@EnabledIfEnvironmentVariable(named="RUN_APPLE_DELETION_MIGRATION", matches="true")
class AppleDeletionMigrationTest {
    @Test void additiveSchemasRollbackPreserveAllRowsAndValidateTheProductionMapping() throws Exception {
        String url = System.getenv("APPLE_DELETION_TEST_JDBC_URL"), user = System.getenv("MIGRATION_TEST_USER"), password = System.getenv("MIGRATION_TEST_PASSWORD");
        assertNotNull(url);
        assertTrue(url.matches("jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/newave_apple_deletion_[a-z0-9_]+"));
        try (var connection = DriverManager.getConnection(url, user, password)) {
            assertEquals("0", EventReadMigrationTest.scalar(connection, "SELECT count(*) FROM pg_tables WHERE schemaname='public'"), "Rehearsal requires a fresh empty database");
        }
        try (var app = application(url, user, password, "create")) { assertTrue(app.isActive()); }
        try (var connection = DriverManager.getConnection(url, user, password); var sql = connection.createStatement()) {
            sql.execute("""
                DROP TABLE account_deletion_requests;
                DROP TABLE apple_auth_flows;
                DROP TABLE apple_accounts;
                CREATE TABLE schema_migrations(version varchar(80) PRIMARY KEY,applied_at timestamp DEFAULT CURRENT_TIMESTAMP);
                INSERT INTO users(id,name,email,password,role,is_active,large_font,auth_version,created_at) VALUES
                  (901,'Synthetic existing teacher','existing-apple@example.invalid','unchanged-password','TEACHER',true,false,7,'2026-10-01'),
                  (902,'Synthetic pending teacher','pending-apple@example.invalid','unchanged-password-2','TEACHER',false,false,0,'2026-10-01');
                INSERT INTO tts_data_entry(id,teacher_id,info_year,week_num,is_submitted) VALUES(901,901,2026,42,true);
                INSERT INTO class_groups(id,name) VALUES(901,'Synthetic shared class');
                INSERT INTO daily_reports(id,class_group_id,teacher_id,report_date,status,total_students,present_count,absent_count,late_count,special_notes)
                  VALUES(901,901,901,'2026-10-11','SUBMITTED',2,2,0,0,'Preserve shared records');
                """);
            var original = EventReadMigrationTest.fingerprints(connection);
            for (String name : List.of("V009__apple_login", "V010__account_deletion_requests")) {
                String migration = Files.readString(Path.of("db/migrations/" + name + ".sql"));
                var before = EventReadMigrationTest.fingerprints(connection);
                try { assertThrows(SQLException.class, () -> sql.execute(migration.replace("INSERT INTO schema_migrations", "SELECT 1/0; INSERT INTO schema_migrations"))); }
                finally { sql.execute("ROLLBACK"); }
                assertEquals(before, EventReadMigrationTest.fingerprints(connection), "Failed migration must restore every table");
                sql.execute(migration);
                try { assertThrows(SQLException.class, () -> sql.execute(migration)); }
                finally { sql.execute("ROLLBACK"); }
                assertEquals("1", EventReadMigrationTest.scalar(connection, "SELECT count(*) FROM schema_migrations WHERE version='" + name + "'"));
            }
            var after = EventReadMigrationTest.fingerprints(connection);
            for (String added : List.of("apple_accounts", "apple_auth_flows", "account_deletion_requests", "schema_migrations")) after.remove(added);
            original.remove("schema_migrations"); assertEquals(original, after, "All existing accounts, passwords, approval state, and shared records must remain identical");
            sql.execute("INSERT INTO apple_accounts(user_id,subject,refresh_token_ciphertext) VALUES(901,'synthetic-subject','synthetic-encrypted-token')");
            assertThrows(SQLException.class, () -> sql.execute("INSERT INTO apple_accounts(user_id,subject,refresh_token_ciphertext) VALUES(902,'synthetic-subject','other-synthetic-token')"));
            assertThrows(SQLException.class, () -> sql.execute("INSERT INTO apple_accounts(user_id,subject,refresh_token_ciphertext) VALUES(9999,'missing-owner','synthetic-token')"));
            assertThrows(SQLException.class, () -> sql.execute("UPDATE apple_accounts SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=901"));
            sql.execute("UPDATE apple_accounts SET revoked_at=CURRENT_TIMESTAMP,refresh_token_ciphertext=NULL WHERE user_id=901");
            sql.execute("""
                INSERT INTO account_deletion_requests(id,user_id,user_created_at,receipt_token_hash,status,requested_at,target_at,handover_required)
                VALUES('11111111-1111-4111-8111-111111111111',901,'2026-10-01',repeat('a',64),'REQUESTED',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+interval '7 days',false)
                """);
            assertThrows(SQLException.class, () -> sql.execute("UPDATE account_deletion_requests SET status='COMPLETED'"));
            assertThrows(SQLException.class, () -> sql.execute("DELETE FROM users WHERE id=901"));
            assertEquals("unchanged-password", EventReadMigrationTest.scalar(connection, "SELECT password FROM users WHERE id=901"));
            assertEquals("false", EventReadMigrationTest.scalar(connection, "SELECT is_active::text FROM users WHERE id=902"));
        }
        try (var app = application(url, user, password, "validate")) { assertTrue(app.isActive()); }
        System.out.println("V009/V010 PASS: rollback, additive account/record preservation, unique Apple ownership, revocation state, receipt constraints, production schema validation");
    }
    private org.springframework.context.ConfigurableApplicationContext application(String url, String user, String password, String ddl) {
        return new SpringApplicationBuilder(NewaveFlowApplication.class).profiles("prod").run(
            "--server.address=127.0.0.1", "--server.port=0", "--spring.datasource.url=" + url, "--spring.datasource.username=" + user, "--spring.datasource.password=" + password,
            "--spring.jpa.hibernate.ddl-auto=" + ddl, "--jwt.secret=" + UUID.randomUUID() + UUID.randomUUID(), "--app.seed.enabled=false", "--kakao.enabled=false", "--apple.enabled=false",
            "--spring.main.banner-mode=off", "--logging.level.root=ERROR");
    }
}
