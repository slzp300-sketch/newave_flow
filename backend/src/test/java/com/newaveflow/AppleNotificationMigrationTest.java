package com.newaveflow;

import com.newaveflow.config.AppleProperties;
import com.newaveflow.service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.file.*;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

/** Optional V011 is exercised only in an explicitly named fresh local synthetic database. */
@EnabledIfEnvironmentVariable(named="RUN_APPLE_NOTIFICATION_MIGRATION",matches="true")
class AppleNotificationMigrationTest {
    @Test void optionalSchemaPreservesExistingRowsAndSerializesDurableNotificationState() throws Exception {
        String url=System.getenv("APPLE_NOTIFICATION_TEST_JDBC_URL"),user=System.getenv("MIGRATION_TEST_USER"),password=System.getenv("MIGRATION_TEST_PASSWORD");
        assertNotNull(url); assertTrue(url.matches("jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/newave_apple_notifications_[a-z0-9_]+"));
        try(var c=DriverManager.getConnection(url,user,password)) { assertEquals("0",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM pg_tables WHERE schemaname='public'")); }
        try(var app=app(url,user,password,"create",false)) { assertTrue(app.isActive()); }
        try(var c=DriverManager.getConnection(url,user,password);var sql=c.createStatement()) {
            sql.execute("""
                CREATE TABLE schema_migrations(version varchar(80) PRIMARY KEY,applied_at timestamp DEFAULT CURRENT_TIMESTAMP);
                INSERT INTO schema_migrations(version) VALUES('V009__apple_login'),('V010__account_deletion_requests');
                INSERT INTO users(id,name,email,password,role,is_active,large_font,auth_version,created_at) VALUES
                  (901,'Synthetic preserved teacher','preserved-notification@example.invalid','preserved-password','TEACHER',true,false,7,'2026-10-01');
                INSERT INTO tts_data_entry(id,teacher_id,info_year,week_num,is_submitted) VALUES(901,901,2026,42,true);
                """);
            var original=EventReadMigrationTest.fingerprints(c);
            assertThrows(Exception.class,()->{try(var unexpected=app(url,user,password,"validate",true)) { fail("Enabled notifications must reject a missing V011 schema"); }});
            assertEquals(original,EventReadMigrationTest.fingerprints(c));
            String migration=Files.readString(Path.of("db/migrations/V011__apple_notifications.sql"));
            try { assertThrows(SQLException.class,()->sql.execute(migration.replace("INSERT INTO schema_migrations","SELECT 1/0; INSERT INTO schema_migrations"))); }
            finally { sql.execute("ROLLBACK"); }
            assertEquals(original,EventReadMigrationTest.fingerprints(c));
            sql.execute(migration);
            try { assertThrows(SQLException.class,()->sql.execute(migration)); } finally { sql.execute("ROLLBACK"); }
            var after=EventReadMigrationTest.fingerprints(c);
            for(String added:List.of("apple_notification_subjects","apple_notification_receipts","schema_migrations")) after.remove(added);
            original.remove("schema_migrations"); assertEquals(original,after);
            assertThrows(SQLException.class,()->sql.execute("INSERT INTO apple_notification_subjects(subject_hash,updated_at) VALUES('invalid',CURRENT_TIMESTAMP)"));
            assertThrows(SQLException.class,()->sql.execute("INSERT INTO apple_notification_subjects(subject_hash,consent_revoked_at,updated_at) VALUES(repeat('a',64),-1,CURRENT_TIMESTAMP)"));
            assertThrows(SQLException.class,()->sql.execute("INSERT INTO apple_notification_subjects(subject_hash,user_id,updated_at) VALUES(repeat('a',64),99999,CURRENT_TIMESTAMP)"));
        }
        try(var app=app(url,user,password,"validate",true)) {
            var states=app.getBean(AppleNotificationStateStore.class);
            var config=app.getBean(AppleProperties.class); assertFalse(config.isEnabled()); assertTrue(config.isNotificationsEnabled());
            var template=new TransactionTemplate(app.getBean(PlatformTransactionManager.class));
            long eventTime=Instant.now().getEpochSecond()-10;
            template.executeWithoutResult(s->{var state=states.lock("synthetic-subject");states.grant(state,901L,eventTime-100);});
            var event=new AppleNotificationVerifier.Event("synthetic-jti","a".repeat(64),"consent-revoked","synthetic-subject",eventTime);
            var locked=new CountDownLatch(1);var release=new CountDownLatch(1);var attempted=new CountDownLatch(1);
            var pool=Executors.newFixedThreadPool(2);
            try {
                var first=pool.submit(()->template.executeWithoutResult(s->{
                    var state=states.lock(event.subject());assertTrue(states.record(state,event));states.revoke(state,event,901L);locked.countDown();
                    try {assertTrue(release.await(5,TimeUnit.SECONDS));}catch(InterruptedException e){throw new IllegalStateException(e);}
                }));
                assertTrue(locked.await(5,TimeUnit.SECONDS));
                var second=pool.submit(()->template.executeWithoutResult(s->{attempted.countDown();var state=states.lock(event.subject());assertFalse(states.record(state,event));assertEquals(eventTime,state.revokedAt());}));
                assertTrue(attempted.await(5,TimeUnit.SECONDS));release.countDown();first.get(10,TimeUnit.SECONDS);second.get(10,TimeUnit.SECONDS);
            }finally {release.countDown();pool.shutdownNow();}
            template.executeWithoutResult(s->{var state=states.lock(event.subject());assertThrows(com.newaveflow.exception.AppException.class,()->states.requireFreshGrant(state,eventTime));states.grant(state,901L,eventTime+1);});
            assertEquals(eventTime+1,states.find(event.subject()).grantStartedAt());
            try(var c=DriverManager.getConnection(url,user,password)) {
                assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM apple_notification_receipts"));
                assertEquals("preserved-password",EventReadMigrationTest.scalar(c,"SELECT password FROM users WHERE id=901"));
                assertEquals("7",EventReadMigrationTest.scalar(c,"SELECT auth_version FROM users WHERE id=901"));
                assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM tts_data_entry WHERE teacher_id=901"));
            }
        }
        System.out.println("V011 PASS: optional activation gate, rollback, unchanged existing data, repeat rejection, PostgreSQL locks and durable replay handling");
    }
    private org.springframework.context.ConfigurableApplicationContext app(String url,String user,String password,String ddl,boolean notifications) {
        return new SpringApplicationBuilder(NewaveFlowApplication.class).profiles("prod").run(
            "--server.address=127.0.0.1","--server.port=0","--spring.datasource.url="+url,"--spring.datasource.username="+user,"--spring.datasource.password="+password,
            "--spring.jpa.hibernate.ddl-auto="+ddl,"--jwt.secret="+UUID.randomUUID()+UUID.randomUUID(),"--app.seed.enabled=false","--kakao.enabled=false","--apple.enabled=false",
            "--apple.notifications-enabled="+notifications,"--apple.client-id=app.synthetic.notifications","--spring.main.banner-mode=off","--logging.level.root=ERROR");
    }
}
