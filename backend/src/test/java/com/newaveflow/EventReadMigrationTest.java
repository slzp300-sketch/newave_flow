package com.newaveflow;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** V002 rehearsal against a CURRENT restored database; never reruns V001. */
@EnabledIfEnvironmentVariable(named="RUN_EVENT_READ_MIGRATION", matches="true")
class EventReadMigrationTest {
    @Test void restoredDatabaseRollsBackMigratesPreservesAllExistingRowsAndValidates() throws Exception {
        String url=System.getenv("MIGRATION_TEST_JDBC_URL"), user=System.getenv("MIGRATION_TEST_USER"), password=System.getenv("MIGRATION_TEST_PASSWORD");
        assertTrue(url.matches("jdbc:postgresql://127\\.0\\.0\\.1:55440/newave_migration_eventreads_[0-9]+"));
        String sql=Files.readString(Path.of("db/migrations/V002__account_event_reads.sql"));
        try(var c=DriverManager.getConnection(url,user,password); var s=c.createStatement()) {
            var before=fingerprints(c);
            try {
                assertThrows(SQLException.class,()->s.execute(sql.replace("INSERT INTO schema_migrations(version)","SELECT 1/0;\nINSERT INTO schema_migrations(version)")));
            } finally { s.execute("ROLLBACK"); }
            assertEquals(before,fingerprints(c));
            s.execute(sql);
            var after=fingerprints(c);
            assertEquals("0",scalar(c,"SELECT count(*) FROM event_reads"));
            after.remove("event_reads"); after.remove("schema_migrations"); before.remove("schema_migrations");
            assertEquals(before,after,"Every existing table must retain all original rows");
            try { assertThrows(SQLException.class,()->s.execute(sql)); } finally { s.execute("ROLLBACK"); }
            assertEquals("1",scalar(c,"SELECT count(*) FROM schema_migrations WHERE version='V002__account_event_reads'"));
            // The current application also expects later additive migrations.
            s.execute(Files.readString(Path.of("db/migrations/V003__event_attendance_window.sql")));
        }
        try(var app=new SpringApplicationBuilder(NewaveFlowApplication.class).profiles("prod").run(
                "--server.address=127.0.0.1","--server.port=0","--spring.datasource.url="+url,
                "--spring.datasource.username="+user,"--spring.datasource.password="+password,
                "--spring.jpa.hibernate.ddl-auto=validate","--jwt.secret="+UUID.randomUUID()+UUID.randomUUID(),
                "--spring.main.banner-mode=off","--logging.level.root=ERROR","--app.seed.enabled=false")) {
            assertTrue(app.isActive());
        }
        System.out.println("V002 restored rehearsal PASS: rollback, all original table hashes, replay rejection, production schema validation");
    }
    static String scalar(Connection c,String sql) throws SQLException {
        try(var s=c.createStatement(); var r=s.executeQuery(sql)) { r.next(); return r.getString(1); }
    }
    static Map<String,String> fingerprints(Connection c) throws SQLException {
        List<String> tables=new ArrayList<>();
        try(var s=c.createStatement(); var r=s.executeQuery("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")) {
            while(r.next()) tables.add(r.getString(1));
        }
        Map<String,String> result=new TreeMap<>();
        for(String table:tables) result.put(table,scalar(c,"SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM \""+table.replace("\"","\"\"")+"\" t"));
        return result;
    }
}
