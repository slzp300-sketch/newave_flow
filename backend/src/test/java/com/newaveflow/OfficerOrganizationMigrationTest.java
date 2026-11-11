package com.newaveflow;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
@EnabledIfEnvironmentVariable(named="RUN_OFFICER_MIGRATION",matches="true")
class OfficerOrganizationMigrationTest {
 @Test void rollbackPreservationAndForeignKeys()throws Exception {
  String url=System.getenv("OFFICER_TEST_JDBC_URL"),user=System.getenv("MIGRATION_TEST_USER"),password=System.getenv("MIGRATION_TEST_PASSWORD");
  assertNotNull(url);assertTrue(url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/newave_officers_[a-z0-9_]+"));
  try(var app=application(url,user,password,"create")){assertTrue(app.isActive());}
  try(var c=DriverManager.getConnection(url,user,password);var s=c.createStatement()) {
   s.execute("DROP TABLE officer_changes,officer_appointments,officer_registry");s.execute("ALTER TABLE users DROP COLUMN organization_executive");
   s.execute("CREATE TABLE schema_migrations(version varchar(80) PRIMARY KEY,applied_at timestamp DEFAULT CURRENT_TIMESTAMP)");s.execute("INSERT INTO schema_migrations(version) VALUES('V019__new_family_team')");
   s.execute("INSERT INTO users(id,name,email,role,is_active,is_suspended,auth_version,large_font,new_family_team) VALUES(901,'Synthetic officer','officer@example.invalid','EXECUTIVE',true,false,0,false,true)");
   var before=EventReadMigrationTest.fingerprints(c);String sql=Files.readString(Path.of("db/migrations/V020__officer_organization.sql"));
   assertThrows(SQLException.class,()->s.execute(sql.replace("INSERT INTO schema_migrations","SELECT 1/0; INSERT INTO schema_migrations")));s.execute("ROLLBACK");assertEquals(before,EventReadMigrationTest.fingerprints(c));
   s.execute(sql);assertEquals("EXECUTIVE",EventReadMigrationTest.scalar(c,"SELECT role FROM users WHERE id=901"));assertEquals("t",EventReadMigrationTest.scalar(c,"SELECT new_family_team FROM users WHERE id=901"));
   s.execute("INSERT INTO officer_appointments(term_year,position,user_id) VALUES(2026,'SECRETARY',901)");
   assertThrows(SQLException.class,()->s.execute("INSERT INTO officer_appointments(term_year,position,user_id) VALUES(2026,'SECRETARY',901)"));
   s.execute("INSERT INTO officer_appointments(term_year,position,user_id) VALUES(2026,'GENERAL',901)");
   s.execute("INSERT INTO officer_changes(action,term_year,position,previous_user_id,next_user_id,actor_id,changed_at) VALUES('ASSIGN',2026,'SECRETARY',901,901,901,CURRENT_TIMESTAMP)");
   s.execute("DELETE FROM users WHERE id=901");assertEquals("2",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM officer_appointments WHERE user_id IS NULL"));
   assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM officer_changes WHERE previous_user_id IS NULL AND next_user_id IS NULL AND actor_id IS NULL"));
   assertThrows(SQLException.class,()->s.execute(sql));s.execute("ROLLBACK");
  }
  try(var app=application(url,user,password,"validate")){assertTrue(app.isActive());}
 }
 private org.springframework.context.ConfigurableApplicationContext application(String url,String user,String password,String ddl){return new SpringApplicationBuilder(NewaveFlowApplication.class).profiles("prod").run("--server.address=127.0.0.1","--server.port=0","--spring.datasource.url="+url,"--spring.datasource.username="+user,"--spring.datasource.password="+password,"--spring.jpa.hibernate.ddl-auto="+ddl,"--app.seed.enabled=false","--kakao.enabled=false","--jwt.secret="+UUID.randomUUID()+UUID.randomUUID(),"--spring.main.banner-mode=off","--logging.level.root=ERROR");}
}
