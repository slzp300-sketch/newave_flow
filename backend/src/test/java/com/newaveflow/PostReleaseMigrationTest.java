package com.newaveflow;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.nio.file.*;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;

/** Executes real SQL only against an explicitly named, disposable local fixture database. */
@EnabledIfEnvironmentVariable(named="RUN_POST_RELEASE_MIGRATION", matches="true")
class PostReleaseMigrationTest {
    @Test void additiveMigrationsPreserveRowsRollbackAndEnforceOwnershipAndDedupe() throws Exception {
        String url=System.getenv("POST_RELEASE_TEST_JDBC_URL");
        assertNotNull(url);
        assertTrue(url.matches("jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/newave_post_release_[a-z0-9_]+"));
        try(var c=DriverManager.getConnection(url,System.getenv("MIGRATION_TEST_USER"),System.getenv("MIGRATION_TEST_PASSWORD"));var s=c.createStatement()) {
            s.execute("""
                CREATE TABLE users(id bigint PRIMARY KEY,name text);
                CREATE TABLE schema_migrations(version varchar(80) PRIMARY KEY,applied_at timestamp DEFAULT CURRENT_TIMESTAMP);
                CREATE TABLE notifications(id bigint PRIMARY KEY,user_id bigint NOT NULL REFERENCES users(id),type varchar(30) CONSTRAINT notifications_type_check CHECK(type IN ('EVENT','MINUTE','SYSTEM')),title text);
                CREATE TABLE meeting_minutes(id bigint PRIMARY KEY,is_active boolean NOT NULL,content text);
                CREATE TABLE tts_answers(id bigint PRIMARY KEY,answer_data text);
                CREATE TABLE tts_legacy_score(id bigint PRIMARY KEY,score integer);
                INSERT INTO users VALUES(1,'Synthetic one'),(2,'Synthetic two');
                INSERT INTO notifications VALUES(1,1,'EVENT','Existing notice');
                INSERT INTO meeting_minutes VALUES(1,true,'Already published'),(2,false,'Draft');
                INSERT INTO tts_answers VALUES(1,'[1,2,3]');
                INSERT INTO tts_legacy_score VALUES(1,87);
                """);
            String push=Files.readString(Path.of("db/migrations/V015__notifications_push.sql"));
            String tts=Files.readString(Path.of("db/migrations/V016__tts_calendar_quarters.sql"));
            assertThrows(SQLException.class,()->s.execute(push)); s.execute("ROLLBACK");
            assertThrows(SQLException.class,()->s.execute(tts)); s.execute("ROLLBACK");
            s.execute("INSERT INTO schema_migrations(version) VALUES('V014__apple_passwordless')");
            var before=EventReadMigrationTest.fingerprints(c);
            assertThrows(SQLException.class,()->s.execute(push.replace("INSERT INTO schema_migrations", "SELECT 1/0; INSERT INTO schema_migrations")));
            s.execute("ROLLBACK"); assertEquals(before,EventReadMigrationTest.fingerprints(c));
            s.execute(push);
            assertEquals("Existing notice",scalar(c,"SELECT title FROM notifications WHERE id=1"));
            assertEquals("true:false",scalar(c,"SELECT (SELECT notification_published::text FROM meeting_minutes WHERE id=1)||':'||(SELECT notification_published::text FROM meeting_minutes WHERE id=2)"));
            assertEquals("0",scalar(c,"SELECT count(*) FROM notification_preferences"));
            s.execute("INSERT INTO notification_preferences(user_id) VALUES(1),(2)");
            assertEquals("0",scalar(c,"SELECT count(*) FROM notification_preferences WHERE push_enabled"));
            var beforeTts=EventReadMigrationTest.fingerprints(c);
            assertThrows(SQLException.class,()->s.execute(tts.replace("INSERT INTO schema_migrations", "SELECT 1/0; INSERT INTO schema_migrations")));
            s.execute("ROLLBACK"); assertEquals(beforeTts,EventReadMigrationTest.fingerprints(c));
            s.execute(tts);
            assertEquals(before.get("tts_answers"),EventReadMigrationTest.fingerprints(c).get("tts_answers"));
            assertEquals(before.get("tts_legacy_score"),EventReadMigrationTest.fingerprints(c).get("tts_legacy_score"));
            s.execute("""
                INSERT INTO notifications(id,user_id,type,title,dedupe_key) VALUES(2,1,'TTS','Synthetic reminder','tts:week'),(3,2,'TTS','Other reminder','tts:week');
                INSERT INTO push_devices VALUES('11111111-1111-4111-8111-111111111111',1,'IOS','synthetic-token',repeat('a',64),NULL,true,CURRENT_TIMESTAMP);
                INSERT INTO push_deliveries(notification_id,installation_id,status,next_attempt_at,expires_at) VALUES(2,'11111111-1111-4111-8111-111111111111','PENDING',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+interval '1 day');
                INSERT INTO tts_linked_snapshots(teacher_id,week_start,link_type,checked) VALUES(1,'2026-03-29','SAT_MEETING',false),(2,'2026-03-29','SAT_MEETING',true);
                """);
            assertThrows(SQLException.class,()->s.execute("INSERT INTO notifications(id,user_id,type,dedupe_key) VALUES(4,1,'TTS','tts:week')"));
            assertThrows(SQLException.class,()->s.execute("INSERT INTO push_devices SELECT '22222222-2222-4222-8222-222222222222',2,platform,token,token_hash,app_version,active,updated_at FROM push_devices"));
            assertThrows(SQLException.class,()->s.execute("INSERT INTO push_deliveries(notification_id,installation_id,status,next_attempt_at,expires_at) SELECT notification_id,installation_id,status,next_attempt_at,expires_at FROM push_deliveries"));
            assertThrows(SQLException.class,()->s.execute("INSERT INTO tts_linked_snapshots(teacher_id,week_start,link_type,checked) VALUES(1,'2026-03-29','SAT_MEETING',true)"));
            assertEquals("false",scalar(c,"SELECT checked::text FROM tts_linked_snapshots WHERE teacher_id=1"));
            s.execute("DELETE FROM notifications WHERE user_id=1; DELETE FROM users WHERE id=1");
            assertEquals("0",scalar(c,"SELECT count(*) FROM push_devices"));
            assertEquals("0",scalar(c,"SELECT count(*) FROM push_deliveries"));
            assertEquals("1",scalar(c,"SELECT count(*) FROM notification_preferences WHERE user_id=2"));
            assertEquals("true",scalar(c,"SELECT checked::text FROM tts_linked_snapshots WHERE teacher_id=2"));
            assertThrows(SQLException.class,()->s.execute(push)); s.execute("ROLLBACK");
            assertThrows(SQLException.class,()->s.execute(tts)); s.execute("ROLLBACK");
        }
    }
    private static String scalar(Connection c,String sql) throws SQLException {
        try(var s=c.createStatement();var r=s.executeQuery(sql)){assertTrue(r.next());return r.getString(1);}
    }
}
