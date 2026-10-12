package com.newaveflow;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.nio.file.*;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="RUN_TTS_LINK_MIGRATION",matches="true")
class TtsLinkMigrationTest {
    @Test void linkRepairPreservesHistoryAndAnswersAndRejectsAmbiguity() throws Exception {
        String url=System.getenv("TTS_LINK_TEST_JDBC_URL");
        assertNotNull(url);assertTrue(url.matches("jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/newave_tts_links_[a-z0-9_]+"));
        try(var c=DriverManager.getConnection(url,System.getenv("MIGRATION_TEST_USER"),System.getenv("MIGRATION_TEST_PASSWORD"));var s=c.createStatement()) {
            s.execute("""
                CREATE TABLE tts_item(id bigint PRIMARY KEY,title text,q_type text,is_active boolean,link_type text);
                CREATE TABLE tts_question_revisions(id bigserial PRIMARY KEY,question_id bigint,effective_from date,title text,type text,emoji text,display_order integer,active boolean,points integer,link_type text,UNIQUE(question_id,effective_from));
                CREATE TABLE schema_migrations(version text PRIMARY KEY);
                CREATE TABLE tts_answers(id bigint PRIMARY KEY,question_id bigint,answer_data text);
                INSERT INTO tts_item VALUES(1,'교사 회의','ATTEND',true,NULL),(2,'온라인 줌 기도모임','ATTEND',true,NULL),(3,'본 예배','ATTEND',true,NULL);
                INSERT INTO tts_question_revisions(question_id,effective_from,title,type,active,points) SELECT id,'1900-01-01',title,q_type,is_active,10 FROM tts_item;
                INSERT INTO tts_answers VALUES(1,1,'true'),(2,2,'false'),(3,3,'true');
                """);
            String sql=Files.readString(Path.of("db/migrations/V005__link_standard_tts_meetings.sql"));
            var original=EventReadMigrationTest.fingerprints(c);
            assertThrows(SQLException.class,()->s.execute(sql.replace("INSERT INTO schema_migrations","PERFORM 1/0; INSERT INTO schema_migrations")));
            s.execute("ROLLBACK");assertEquals(original,EventReadMigrationTest.fingerprints(c));
            s.execute("INSERT INTO tts_item VALUES(4,'교사회의','ATTEND',true,NULL)");
            assertThrows(SQLException.class,()->s.execute(sql));s.execute("ROLLBACK");
            assertEquals("0",scalar(c,"SELECT count(*) FROM tts_item WHERE link_type IS NOT NULL"));s.execute("DELETE FROM tts_item WHERE id=4");
            s.execute("INSERT INTO tts_question_revisions(question_id,effective_from,title,type,active) VALUES(1,CURRENT_DATE+14,'교사회의','ATTEND',true)");
            assertThrows(SQLException.class,()->s.execute(sql));s.execute("ROLLBACK");
            s.execute("DELETE FROM tts_question_revisions WHERE effective_from>'1900-01-01'");
            s.execute(sql);
            assertEquals(original.get("tts_answers"),EventReadMigrationTest.fingerprints(c).get("tts_answers"));
            assertEquals("3",scalar(c,"SELECT count(*) FROM tts_question_revisions WHERE effective_from='1900-01-01' AND link_type IS NULL"));
            assertEquals("SAT_MEETING",scalar(c,"SELECT link_type FROM tts_item WHERE id=1"));
            assertEquals("PRAYER_MEETING",scalar(c,"SELECT link_type FROM tts_item WHERE id=2"));
            assertNull(scalar(c,"SELECT link_type FROM tts_item WHERE id=3"));
            assertEquals("2",scalar(c,"SELECT count(*) FROM tts_question_revisions WHERE effective_from>'1900-01-01' AND points=10 AND link_type IS NOT NULL"));
            assertThrows(SQLException.class,()->s.execute(sql));s.execute("ROLLBACK");
        }
    }
    private String scalar(Connection c,String sql)throws SQLException {try(var s=c.createStatement();var r=s.executeQuery(sql)){assertTrue(r.next());return r.getString(1);}}
}
