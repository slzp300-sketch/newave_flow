package com.newaveflow;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.nio.file.*;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="RUN_TTS_MANUAL_MIGRATION",matches="true")
class TtsManualMigrationTest {
    @Test void manualTransitionPreservesAnswersPastRulesAndOtherItemsAndRejectsUnexpectedConfiguration() throws Exception {
        String url=System.getenv("TTS_MANUAL_TEST_JDBC_URL");
        assertNotNull(url);assertTrue(url.matches("jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/newave_tts_manual_[a-z0-9_]+"));
        try(var c=DriverManager.getConnection(url,System.getenv("MIGRATION_TEST_USER"),System.getenv("MIGRATION_TEST_PASSWORD"));var s=c.createStatement()) {
            s.execute("""
                CREATE TABLE tts_item(id bigint PRIMARY KEY,title text,q_type text,is_active boolean,link_type text);
                CREATE TABLE tts_question_revisions(id bigserial PRIMARY KEY,question_id bigint,effective_from date,title text,type text,emoji text,display_order integer,active boolean,points integer,link_type text,UNIQUE(question_id,effective_from));
                CREATE TABLE schema_migrations(version text PRIMARY KEY);
                CREATE TABLE tts_answers(id bigint PRIMARY KEY,question_id bigint,answer_data text);
                INSERT INTO schema_migrations VALUES('V005__link_standard_tts_meetings');
                INSERT INTO tts_item VALUES(1,'교사 회의','ATTEND',true,'SAT_MEETING'),(2,'온라인 줌 기도모임','ATTEND',true,'PRAYER_MEETING'),(3,'다른 연동 항목','ATTEND',true,'SAT_MEETING');
                INSERT INTO tts_question_revisions(question_id,effective_from,title,type,emoji,display_order,active,points,link_type) SELECT id,'1900-01-01',title,q_type,'original',id,is_active,10,link_type FROM tts_item;
                INSERT INTO tts_question_revisions(question_id,effective_from,title,type,emoji,display_order,active,points,link_type)
                  SELECT id,((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date - EXTRACT(DOW FROM CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::integer),title,q_type,'current',id,is_active,17,link_type FROM tts_item WHERE id=2;
                INSERT INTO tts_answers VALUES(1,1,'true'),(2,2,'false'),(3,3,'true');
                """);
            String sql=Files.readString(Path.of("db/migrations/V007__manual_standard_tts_meetings.sql"));
            var original=EventReadMigrationTest.fingerprints(c);
            assertThrows(SQLException.class,()->s.execute(sql.replace("INSERT INTO schema_migrations","PERFORM 1/0; INSERT INTO schema_migrations")));
            s.execute("ROLLBACK");assertEquals(original,EventReadMigrationTest.fingerprints(c));
            s.execute("INSERT INTO tts_item VALUES(4,'교사회의','ATTEND',true,'SAT_MEETING')");
            assertThrows(SQLException.class,()->s.execute(sql));s.execute("ROLLBACK");s.execute("DELETE FROM tts_item WHERE id=4");
            long futureRevision;
            try(var row=s.executeQuery("INSERT INTO tts_question_revisions(question_id,effective_from,title,type,active,link_type) VALUES(1,CURRENT_DATE+14,'교사회의','ATTEND',true,'NONE') RETURNING id")) {
                assertTrue(row.next()); futureRevision=row.getLong(1);
            }
            assertThrows(SQLException.class,()->s.execute(sql));s.execute("ROLLBACK");
            // Remove only the injected row; UTC CURRENT_DATE can lag the current Korean Sunday.
            s.execute("DELETE FROM tts_question_revisions WHERE id="+futureRevision);
            s.execute("UPDATE tts_item SET link_type='NONE' WHERE id=2");
            assertThrows(SQLException.class,()->s.execute(sql));s.execute("ROLLBACK");s.execute("UPDATE tts_item SET link_type='PRAYER_MEETING' WHERE id=2");
            assertEquals(original,EventReadMigrationTest.fingerprints(c));
            s.execute(sql);
            assertEquals(original.get("tts_answers"),EventReadMigrationTest.fingerprints(c).get("tts_answers"));
            assertEquals("3",scalar(c,"SELECT count(*) FROM tts_question_revisions WHERE effective_from='1900-01-01' AND link_type IN ('SAT_MEETING','PRAYER_MEETING')"));
            assertEquals("NONE",scalar(c,"SELECT link_type FROM tts_item WHERE id=1"));
            assertEquals("NONE",scalar(c,"SELECT link_type FROM tts_item WHERE id=2"));
            assertEquals("SAT_MEETING",scalar(c,"SELECT link_type FROM tts_item WHERE id=3"));
            assertEquals("10",scalar(c,"SELECT points FROM tts_question_revisions WHERE question_id=1 AND effective_from>'1900-01-01'"));
            assertEquals("17:current:2:NONE",scalar(c,"SELECT points||':'||emoji||':'||display_order||':'||link_type FROM tts_question_revisions WHERE question_id=2 AND effective_from>'1900-01-01'"));
            assertThrows(SQLException.class,()->s.execute(sql));s.execute("ROLLBACK");
        }
    }
    private String scalar(Connection c,String sql)throws SQLException {try(var s=c.createStatement();var r=s.executeQuery(sql)){assertTrue(r.next());return r.getString(1);}}
}
