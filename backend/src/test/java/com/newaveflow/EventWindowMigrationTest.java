package com.newaveflow;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** Rehearse V003 on a private restored copy; retain the original values of every column. */
@EnabledIfEnvironmentVariable(named="RUN_EVENT_WINDOW_MIGRATION",matches="true")
class EventWindowMigrationTest {
    @Test void restoredV003RollsBackPreservesExistingColumnsAndStartsValidatedApp() throws Exception {
        String url=System.getenv("MIGRATION_TEST_JDBC_URL"),user=System.getenv("MIGRATION_TEST_USER"),password=System.getenv("MIGRATION_TEST_PASSWORD");
        assertTrue(url.matches("jdbc:postgresql://127\\.0\\.0\\.1:55440/newave_migration_eventwindow_[0-9]+"));
        String sql=Files.readString(Path.of("db/migrations/V003__event_attendance_window.sql"));
        try(var c=DriverManager.getConnection(url,user,password);var s=c.createStatement()) {
            var before=fingerprints(c);
            try { assertThrows(SQLException.class,()->s.execute(sql.replace("INSERT INTO schema_migrations(version)","SELECT 1/0;\nINSERT INTO schema_migrations(version)"))); }
            finally { s.execute("ROLLBACK"); }
            assertEquals(before,fingerprints(c));
            assertEquals("0",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='attendance_start_date'"));
            s.execute(sql);
            var after=fingerprints(c);after.remove("schema_migrations");before.remove("schema_migrations");
            assertEquals(before,after,"Existing fields in every table must stay unchanged");
            assertEquals("0",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM events WHERE attendance_start_date IS NOT NULL"));
            try { assertThrows(SQLException.class,()->s.execute(sql)); } finally { s.execute("ROLLBACK"); }
            assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM schema_migrations WHERE version='V003__event_attendance_window'"));
            s.execute(Files.readString(Path.of("db/migrations/V006__kakao_login.sql")));
        }
        try(var app=new SpringApplicationBuilder(NewaveFlowApplication.class).profiles("prod").run(
                "--server.address=127.0.0.1","--server.port=0","--spring.datasource.url="+url,
                "--spring.datasource.username="+user,"--spring.datasource.password="+password,
                "--spring.jpa.hibernate.ddl-auto=validate","--jwt.secret="+UUID.randomUUID()+UUID.randomUUID(),
                "--spring.main.banner-mode=off","--logging.level.root=ERROR","--app.seed.enabled=false")) {
            assertTrue(app.isActive());
        }
        System.out.println("V003 restored rehearsal PASS: rollback, original column hashes, replay rejection, production schema validation");
    }
    static Map<String,String> fingerprints(Connection c) throws SQLException {
        List<String> tables=new ArrayList<>();
        try(var s=c.createStatement();var r=s.executeQuery("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")) {
            while(r.next()) tables.add(r.getString(1));
        }
        Map<String,String> result=new TreeMap<>();
        for(String table:tables) {
            String row=table.equals("events")?"(to_jsonb(t)-'attendance_start_date')":"to_jsonb(t)";
            result.put(table,EventReadMigrationTest.scalar(c,"SELECT md5(coalesce(string_agg(md5("+row+"::text),'' ORDER BY md5("+row+"::text)),'')) FROM \""+table.replace("\"","\"\"")+"\" t"));
        }
        return result;
    }
}
