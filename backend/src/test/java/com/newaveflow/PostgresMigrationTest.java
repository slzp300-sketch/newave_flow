package com.newaveflow;

import com.newaveflow.config.*;
import com.newaveflow.dto.attendance.AttendanceBatchRequest;
import com.newaveflow.dto.tts.TtsAnswerRequest;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import java.nio.file.*;
import java.sql.*;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** Opt-in destructive rehearsal, restricted to a named local disposable database. */
@EnabledIfEnvironmentVariable(named="RUN_POSTGRES_MIGRATION", matches="true")
class PostgresMigrationTest {
    private String url, user, password;
    private Connection connect() throws SQLException { return DriverManager.getConnection(url,user,password); }
    private String scalar(String sql) throws SQLException {
        try(var c=connect();var s=c.createStatement();var r=s.executeQuery(sql)) { r.next(); return r.getString(1); }
    }
    private long count(String sql) throws SQLException { return Long.parseLong(scalar(sql)); }
    private void execute(String sql) throws SQLException {
        try(var c=connect();var s=c.createStatement()) {
            try { s.execute(sql); }
            catch(SQLException e) { s.execute("ROLLBACK"); throw e; }
        }
    }
    private String checksum(String table) throws SQLException {
        // Values stay inside PostgreSQL; only a checksum is returned, never private rows.
        return scalar("SELECT md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY t.id),'')) FROM "+table+" t");
    }

    @Test void migrationRollsBackPreservesRowsRejectsReplayAndStartsValidatedApp() throws Exception {
        url=System.getenv("MIGRATION_TEST_JDBC_URL"); user=System.getenv("MIGRATION_TEST_USER"); password=System.getenv("MIGRATION_TEST_PASSWORD");
        assertNotNull(url);
        assertTrue(url.matches("jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/newave_migration_[a-z0-9_]+"),"Only a local disposable migration DB is allowed");
        boolean synthetic="true".equals(System.getenv("MIGRATION_SYNTHETIC_FIXTURE"));
        if(synthetic) {
            assertEquals(0,count("SELECT count(*) FROM users"),"Synthetic fixture needs an empty baseline DB");
            execute("BEGIN;\n"+Files.readString(Path.of("db/verification/fixture.sql"))+"\nCOMMIT;");
        }
        String migration=Files.readString(Path.of("db/migrations/V001__security_shared_reports_and_history.sql"));
        var unchanged=new LinkedHashMap<String,String>();
        for(String table:List.of("attendances","event_student_attendances","event_attendances","tts_data_entry","tts_answers","tts_item"))
            unchanged.put(table,checksum(table));
        String reportsBefore=checksum("daily_reports");
        long reportsCount=count("SELECT count(*) FROM daily_reports");
        long classDates=count("SELECT count(*) FROM (SELECT class_group_id,report_date FROM daily_reports GROUP BY 1,2) t");
        long eligibleEvents=count("SELECT count(*) FROM events e WHERE e.attendance_required OR EXISTS(SELECT 1 FROM event_student_attendances a WHERE a.event_id=e.id) OR EXISTS(SELECT 1 FROM event_attendances a WHERE a.event_id=e.id)");

        // Fail after every transformation, just before the version marker and commit.
        String injected=migration.replace("INSERT INTO schema_migrations(version)","SELECT 1/0;\nINSERT INTO schema_migrations(version)");
        assertThrows(SQLException.class,()->execute(injected));
        assertEquals(reportsBefore,checksum("daily_reports"),"Failed transaction must restore original reports");
        assertEquals(0,count("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='daily_reports_before_class_merge'"));
        assertEquals(0,count("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='auth_version'"));

        execute(migration);
        assertEquals(reportsCount,count("SELECT count(*) FROM daily_reports_before_class_merge"));
        assertEquals(reportsBefore,checksum("daily_reports_before_class_merge"),"Every original report must be archived unchanged");
        assertEquals(classDates,count("SELECT count(*) FROM daily_reports"));
        assertEquals(0,count("SELECT count(*) FROM (SELECT class_group_id,report_date FROM daily_reports GROUP BY 1,2 HAVING count(*)>1) t"));
        assertEquals(eligibleEvents,count("SELECT count(*) FROM events WHERE roster_captured_at IS NOT NULL"));
        assertEquals(count("SELECT count(*) FROM tts_item"),count("SELECT count(*) FROM tts_question_revisions"));
        assertEquals(0,count("SELECT count(*) FROM tts_item q JOIN tts_question_revisions r ON r.question_id=q.id WHERE ROW(q.title,q.q_type,q.emoji,q.display_order,q.is_active,q.points,q.link_type) IS DISTINCT FROM ROW(r.title,r.type,r.emoji,r.display_order,r.active,r.points,r.link_type)"));
        for(var entry:unchanged.entrySet()) assertEquals(entry.getValue(),checksum(entry.getKey()),entry.getKey()+" must remain unchanged");

        String merged=checksum("daily_reports"), roster=checksum("event_participants");
        SQLException repeated=assertThrows(SQLException.class,()->execute(migration));
        assertTrue(repeated.getMessage().contains("already applied"));
        assertEquals(merged,checksum("daily_reports")); assertEquals(roster,checksum("event_participants"));
        assertEquals(1,count("SELECT count(*) FROM schema_migrations"));

        try(var app=new SpringApplicationBuilder(NewaveFlowApplication.class).profiles("prod").run(
                "--server.address=127.0.0.1","--server.port=0","--spring.datasource.url="+url,
                "--spring.datasource.username="+user,"--spring.datasource.password="+password,
                "--spring.jpa.hibernate.ddl-auto=validate","--jwt.secret="+UUID.randomUUID()+UUID.randomUUID(),
                "--spring.main.banner-mode=off","--logging.level.root=ERROR","--app.seed.enabled=false")) {
            assertTrue(app.getBeansOfType(DataInitService.class).isEmpty());
            assertTrue(app.getBeansOfType(RosterDataInitService.class).isEmpty());
            assertTrue(app.getBeansOfType(TtsDataInitializer.class).isEmpty());
            if(synthetic) verifySyntheticWorkflows(app);
        }
        System.out.println("PostgreSQL migration PASS: rollback, original archive, shared reports, unchanged attendance/TTS, baseline history, replay rejection, prod schema validation"+(synthetic?", synthetic workflows":"; restored database"));
    }

    private void verifySyntheticWorkflows(ConfigurableApplicationContext app) throws Exception {
        assertEquals("SUBMITTED",scalar("SELECT status FROM daily_reports WHERE id=1"));
        assertEquals("2",scalar("SELECT teacher_id FROM daily_reports WHERE id=1"));
        assertEquals("1",scalar("SELECT total_students FROM daily_reports WHERE id=1"));
        assertTrue(scalar("SELECT special_notes FROM daily_reports WHERE id=1").contains("담임 메모"));
        assertTrue(scalar("SELECT special_notes FROM daily_reports WHERE id=1").contains("부담임 메모"));
        assertEquals("같은 메모",scalar("SELECT special_notes FROM daily_reports WHERE id=3"));
        assertEquals(10,count("SELECT count(*) FROM event_participants"));
        assertEquals(0,count("SELECT count(*) FROM event_participants WHERE event_id=3"));
        assertEquals(2,count("SELECT count(*) FROM event_participants WHERE kind='STUDENT' AND person_id=2"));
        assertEquals(2,count("SELECT count(*) FROM event_participants WHERE kind='TEACHER' AND person_id=3"));
        var teacher=app.getBean(UserRepository.class).findById(1L).orElseThrow();
        var tts=app.getBean(TtsService.class); var events=app.getBean(EventService.class);
        LocalDate day=LocalDate.of(2026,1,4);
        assertEquals(15,tts.getWeek(teacher,day).getScore());
        var questions=app.getBean(TtsQuestionRepository.class).findAll(); questions.forEach(q->q.setPoints(50));
        tts.updateQuestions(questions);
        assertEquals(15,tts.getWeek(teacher,day).getScore());
        tts.saveAnswer(teacher,new TtsAnswerRequest(day,1L,"{\"월\":true,\"화\":true}"));
        assertEquals(20,tts.getWeek(teacher,day).getScore());
        String snapshot=checksum("event_participants");
        execute("UPDATE students SET class_group_id=2,is_active=false WHERE id=1");
        assertEquals(snapshot,checksum("event_participants"));
        assertEquals(2,events.getStudentAttendanceSummary(1L).get(0).totalCount());
        execute("UPDATE students SET class_group_id=1,is_active=true WHERE id=1");
        var attendance=app.getBean(AttendanceService.class);
        var batch=new AttendanceBatchRequest(1L,day,List.of(new AttendanceBatchRequest.Record(1L,"PRESENT","","")));
        attendance.saveBatch(batch,1L); attendance.saveBatch(batch,2L); attendance.submitReport(1L,day,2L);
        assertEquals(1,count("SELECT count(*) FROM daily_reports WHERE class_group_id=1 AND report_date=DATE '2026-01-04'"));
        assertEquals(2,app.getBean(ReportService.class).getSummary(day).submitted());
    }
}
