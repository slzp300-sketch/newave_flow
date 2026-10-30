package com.newaveflow;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
@EnabledIfEnvironmentVariable(named="RUN_NEW_FAMILY_MIGRATION",matches="true")
class NewFamilyMigrationTest {
 @Test void rollsBackPreservesExistingRowsAndValidatesSchema()throws Exception {
  String url=System.getenv("NEW_FAMILY_TEST_JDBC_URL"),user=System.getenv("MIGRATION_TEST_USER"),password=System.getenv("MIGRATION_TEST_PASSWORD");
  assertNotNull(url);assertTrue(url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/newave_new_family_[a-z0-9_]+"));
  try(var app=application(url,user,password,"create")){assertTrue(app.isActive());}
  try(var c=DriverManager.getConnection(url,user,password);var s=c.createStatement()) {
   s.execute("DROP TABLE new_family_references,new_family_checks,new_family_submissions,new_family_members,new_family_registry");
   s.execute("ALTER TABLE users DROP COLUMN new_family_team");s.execute("ALTER TABLE students DROP COLUMN class_effective_date");s.execute("ALTER TABLE students ALTER COLUMN class_group_id SET NOT NULL");
   s.execute("CREATE TABLE schema_migrations(version varchar(80) PRIMARY KEY,applied_at timestamp DEFAULT CURRENT_TIMESTAMP)");s.execute("INSERT INTO schema_migrations(version) VALUES('V018__teacher_profile_gender')");
   s.execute("INSERT INTO class_groups(id,name,age_group) VALUES(901,'Synthetic existing class','중1')");
   s.execute("INSERT INTO students(id,name,grade,class_group_id,is_active) VALUES(901,'Synthetic existing student','중1',901,true)");
   var before=EventReadMigrationTest.fingerprints(c);String sql=Files.readString(Path.of("db/migrations/V019__new_family_team.sql"));
   assertThrows(SQLException.class,()->s.execute(sql.replace("INSERT INTO schema_migrations","SELECT 1/0; INSERT INTO schema_migrations")));s.execute("ROLLBACK");assertEquals(before,EventReadMigrationTest.fingerprints(c));
   s.execute(sql);assertEquals("Synthetic existing student",EventReadMigrationTest.scalar(c,"SELECT name FROM students WHERE id=901"));assertEquals("901",EventReadMigrationTest.scalar(c,"SELECT class_group_id FROM students WHERE id=901"));
   s.execute("INSERT INTO students(id,name,grade,is_active) VALUES(902,'Synthetic first visit','중1',true)");
   s.execute("INSERT INTO new_family_members(student_id,first_visit,updated_at) VALUES(902,'2026-10-25',CURRENT_TIMESTAMP)");
   assertThrows(SQLException.class,()->s.execute("INSERT INTO new_family_members(student_id,first_visit,updated_at) VALUES(902,'2026-10-25',CURRENT_TIMESTAMP)"));
   assertThrows(SQLException.class,()->s.execute(sql));s.execute("ROLLBACK");
  }
  try(var app=application(url,user,password,"validate")){assertTrue(app.isActive());}
 }
 private org.springframework.context.ConfigurableApplicationContext application(String url,String user,String password,String ddl){return new SpringApplicationBuilder(NewaveFlowApplication.class).profiles("prod").run("--server.address=127.0.0.1","--server.port=0","--spring.datasource.url="+url,"--spring.datasource.username="+user,"--spring.datasource.password="+password,"--spring.jpa.hibernate.ddl-auto="+ddl,"--app.seed.enabled=false","--kakao.enabled=false","--jwt.secret="+UUID.randomUUID()+UUID.randomUUID(),"--spring.main.banner-mode=off","--logging.level.root=ERROR");}
}
