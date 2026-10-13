package com.newaveflow;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** V006 rehearsal on an empty synthetic DB or private restored copy, never production. */
@EnabledIfEnvironmentVariable(named="RUN_KAKAO_MIGRATION", matches="true")
class KakaoMigrationTest {
    @Test void additiveMigrationRollsBackPreservesRowsAndValidatesCurrentApp() throws Exception {
        String url=System.getenv("KAKAO_TEST_JDBC_URL"), user=System.getenv("MIGRATION_TEST_USER"), password=System.getenv("MIGRATION_TEST_PASSWORD");
        assertNotNull(url);
        assertTrue(url.matches("jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/newave_kakao_[a-z0-9_]+"));
        boolean synthetic="true".equals(System.getenv("KAKAO_SYNTHETIC_FIXTURE"));
        if(synthetic) {
            try(var c=DriverManager.getConnection(url,user,password)) {
                assertEquals("0",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM pg_tables WHERE schemaname='public'"),"Synthetic rehearsal requires a fresh empty DB");
            }
            try(var app=application(url,user,password,"create")) { assertTrue(app.isActive()); }
            try(var c=DriverManager.getConnection(url,user,password);var s=c.createStatement()) {
                s.execute("""
                    DROP TABLE kakao_auth_flows;
                    ALTER TABLE users DROP COLUMN kakao_id;
                    CREATE TABLE schema_migrations(version varchar(80) PRIMARY KEY,applied_at timestamp DEFAULT CURRENT_TIMESTAMP);
                    INSERT INTO users(id,name,email,password,role,is_active,large_font,auth_version,created_at)
                    VALUES(1,'가상 기존 교사','kakao-fixture@example.invalid','unchanged-password','TEACHER',true,false,3,'2026-10-01');
                    INSERT INTO tts_data_entry(id,teacher_id,info_year,week_num,is_submitted) VALUES(1,1,2026,42,true);
                    """);
            }
        }
        String migration=Files.readString(Path.of("db/migrations/V006__kakao_login.sql"));
        try(var c=DriverManager.getConnection(url,user,password);var s=c.createStatement()) {
            var before=fingerprints(c);
            try { assertThrows(SQLException.class,()->s.execute(migration.replace("INSERT INTO schema_migrations(version)","SELECT 1/0; INSERT INTO schema_migrations(version)"))); }
            finally { s.execute("ROLLBACK"); }
            assertEquals(before,fingerprints(c),"Failed DDL must restore every original table");
            assertEquals("0",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='kakao_id'"));
            s.execute(migration);
            var after=fingerprints(c); after.remove("kakao_auth_flows"); after.remove("schema_migrations"); before.remove("schema_migrations");
            assertEquals(before,after,"All original user fields and church records must remain identical");
            assertEquals("0",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM users WHERE kakao_id IS NOT NULL"));
            assertEquals("0",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM kakao_auth_flows"));
            try { assertThrows(SQLException.class,()->s.execute(migration)); } finally { s.execute("ROLLBACK"); }
            assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM schema_migrations WHERE version='V006__kakao_login'"));
            if(synthetic) {
                s.execute("UPDATE users SET kakao_id='9201' WHERE id=1");
                assertThrows(SQLException.class,()->s.execute("INSERT INTO users(name,email,password,role,is_active,large_font,auth_version,kakao_id) VALUES('다른 교사','duplicate@example.invalid','synthetic','TEACHER',true,false,0,'9201')"));
                assertThrows(SQLException.class,()->s.execute("INSERT INTO kakao_auth_flows(id,state_hash,challenge,purpose,stage,native_client,expires_at,user_id) VALUES('11111111-1111-4111-8111-000000000001',repeat('a',64),repeat('a',43),'LINK','STARTED',false,CURRENT_TIMESTAMP+interval '1 hour',9999)"));
            }
        }
        try(var app=application(url,user,password,"validate")) { assertTrue(app.isActive()); }
        System.out.println("V006 PASS: transaction rollback, unchanged user IDs/passwords/roles/records, replay rejection, unique provider ownership, production schema validation");
    }
    private org.springframework.context.ConfigurableApplicationContext application(String url,String user,String password,String ddl) {
        return new SpringApplicationBuilder(NewaveFlowApplication.class).profiles("prod").run(
            "--server.address=127.0.0.1","--server.port=0","--spring.datasource.url="+url,"--spring.datasource.username="+user,"--spring.datasource.password="+password,
            "--spring.jpa.hibernate.ddl-auto="+ddl,"--jwt.secret="+UUID.randomUUID()+UUID.randomUUID(),"--app.seed.enabled=false","--kakao.enabled=false",
            "--spring.main.banner-mode=off","--logging.level.root=ERROR");
    }
    private Map<String,String> fingerprints(Connection c) throws SQLException {
        var result=new TreeMap<String,String>(); var tables=new ArrayList<String>();
        try(var s=c.createStatement();var r=s.executeQuery("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")) { while(r.next()) tables.add(r.getString(1)); }
        for(String table:tables) {
            String row=table.equals("users")?"(to_jsonb(t)-'kakao_id')":"to_jsonb(t)";
            result.put(table,EventReadMigrationTest.scalar(c,"SELECT md5(coalesce(string_agg(md5("+row+"::text),'' ORDER BY md5("+row+"::text)),'')) FROM \""+table.replace("\"","\"\"")+"\" t"));
        }
        return result;
    }
}
