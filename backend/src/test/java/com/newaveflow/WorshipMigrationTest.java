package com.newaveflow;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
@EnabledIfEnvironmentVariable(named="RUN_WORSHIP_MIGRATION",matches="true")
class WorshipMigrationTest {
 @Test void additiveMigrationRollsBackPreservesRowsAndValidatesAgainstPostgres()throws Exception{
  String url=System.getenv("WORSHIP_TEST_JDBC_URL"),user=System.getenv("MIGRATION_TEST_USER");
  assertTrue(url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/newave_worship_[a-z0-9_]+"));
  try(var app=app(url,user,"create")){assertTrue(app.isActive());}
  try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()){
   s.execute("DROP TABLE worship_offerings,worship_tasks,worship_weeks,worship_members,worship_registry");
   s.execute("DROP TABLE IF EXISTS schema_migrations; CREATE TABLE schema_migrations(version varchar(80) PRIMARY KEY,applied_at timestamp DEFAULT CURRENT_TIMESTAMP); INSERT INTO schema_migrations(version) VALUES('V025__intercession_request_updates')");
   s.execute("INSERT INTO users(id,name,email,role,is_active,is_suspended,auth_version,large_font,new_family_team,organization_executive) VALUES(9001,'Synthetic worship','worship@example.invalid','TEACHER',true,false,0,false,false,false)");
   var before=EventReadMigrationTest.fingerprints(c);String sql=Files.readString(Path.of("db/migrations/V026__worship_team.sql"));
   assertThrows(SQLException.class,()->s.execute(sql.replace("INSERT INTO schema_migrations","SELECT 1/0; INSERT INTO schema_migrations")));s.execute("ROLLBACK");assertEquals(before,EventReadMigrationTest.fingerprints(c));
   s.execute(sql);var after=EventReadMigrationTest.fingerprints(c);after.keySet().removeIf(k->k.startsWith("worship_"));after.remove("schema_migrations");before.remove("schema_migrations");assertEquals(before,after);
   s.execute("INSERT INTO worship_members(id) VALUES(9001); INSERT INTO worship_weeks(worship_date,id,offering_prayer_id,announced_by_id) VALUES('2026-11-08',DATE '2026-11-08'-DATE '1970-01-01',9001,9001)");
   s.execute("INSERT INTO worship_tasks(worship_date,task_key,assignee_id,completed_by_id,reviewed_by_id) VALUES('2026-11-08','banner',9001,9001,9001)");
   s.execute("UPDATE worship_weeks SET notice_message='Synthetic institution note'");
   String scope=Files.readString(Path.of("db/privacy/content-scope.sql")).trim();
   assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM ("+scope+") scope WHERE table_name='worship_weeks' AND column_name='notice_message'"));
   assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM worship_weeks WHERE id>0 AND notice_message<>''"));
   assertThrows(SQLException.class,()->s.execute("INSERT INTO worship_weeks(worship_date,id) VALUES('2026-11-09',DATE '2026-11-09'-DATE '1970-01-01')"));
   assertThrows(SQLException.class,()->s.execute("INSERT INTO worship_tasks(worship_date,task_key) VALUES('2026-11-08','banner')"));
   s.execute("INSERT INTO students(id,name,grade,is_active) VALUES(9001,'Synthetic one','중1',true),(9002,'Synthetic two','고1',true)");
   s.execute("INSERT INTO worship_offerings(worship_date,student_id,position) VALUES('2026-11-08',9001,0),('2026-11-08',9002,1)");
   // Hibernate updates ordered slots separately; the uniqueness check must be deferred.
   s.execute("BEGIN; UPDATE worship_offerings SET student_id=9002 WHERE position=0; UPDATE worship_offerings SET student_id=9001 WHERE position=1; COMMIT");
   s.execute("DELETE FROM users WHERE id=9001");
   assertEquals("0",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM worship_members"));
   assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM worship_weeks WHERE offering_prayer_id IS NULL AND announced_by_id IS NULL"));
   assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM worship_tasks WHERE assignee_id IS NULL AND completed_by_id IS NULL AND reviewed_by_id IS NULL"));
   assertThrows(SQLException.class,()->s.execute(sql));s.execute("ROLLBACK");
  }
  try(var app=app(url,user,"validate")){assertTrue(app.isActive());}
 }
 private org.springframework.context.ConfigurableApplicationContext app(String url,String user,String ddl){
  return new SpringApplicationBuilder(NewaveFlowApplication.class).profiles("prod").run("--server.address=127.0.0.1","--server.port=0","--spring.datasource.url="+url,"--spring.datasource.username="+user,"--spring.datasource.password=","--spring.jpa.hibernate.ddl-auto="+ddl,"--app.seed.enabled=false","--app.review.mode=false","--kakao.enabled=false","--apple.enabled=false","--push.enabled=false","--jwt.secret="+UUID.randomUUID()+UUID.randomUUID(),"--spring.main.banner-mode=off","--logging.level.root=ERROR");
 }
}
