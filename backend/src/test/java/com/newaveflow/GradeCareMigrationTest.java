package com.newaveflow;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
@EnabledIfEnvironmentVariable(named="RUN_GRADE_CARE_MIGRATION",matches="true")
class GradeCareMigrationTest {
 @Test void migrationPreservesExistingDataRollsBackAndValidates()throws Exception{
  String url=System.getenv("GRADE_CARE_TEST_JDBC_URL"),user=System.getenv("MIGRATION_TEST_USER");
  assertTrue(url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/newave_grade_care_[a-z0-9_]+"));
  try(var app=app(url,user,"create")){assertTrue(app.isActive());}
  try(var c=DriverManager.getConnection(url,user,System.getenv().getOrDefault("MIGRATION_TEST_PASSWORD",""));var s=c.createStatement()){
   s.execute("DROP TABLE student_care_changes,student_care_records; DROP TABLE IF EXISTS schema_migrations; CREATE TABLE schema_migrations(version varchar(80) PRIMARY KEY,applied_at timestamp DEFAULT CURRENT_TIMESTAMP); INSERT INTO schema_migrations(version) VALUES('V026__worship_team')");
   s.execute("INSERT INTO users(id,name,email,role,is_active,is_suspended,auth_version,large_font,new_family_team,organization_executive) VALUES(9001,'Synthetic carer','care@example.invalid','TEACHER',true,false,0,false,false,false); INSERT INTO students(id,name,grade,is_active) VALUES(9001,'Synthetic student','중1',true)");
   var before=EventReadMigrationTest.fingerprints(c);String sql=Files.readString(Path.of("db/migrations/V027__grade_student_care.sql"));
   assertThrows(SQLException.class,()->s.execute(sql.replace("INSERT INTO schema_migrations","SELECT 1/0; INSERT INTO schema_migrations")));s.execute("ROLLBACK");assertEquals(before,EventReadMigrationTest.fingerprints(c));
   s.execute(sql);var after=EventReadMigrationTest.fingerprints(c);after.keySet().removeIf(k->k.startsWith("student_care_"));after.remove("schema_migrations");before.remove("schema_migrations");assertEquals(before,after);
   s.execute("INSERT INTO student_care_records(id,student_id,author_id,kind,content,created_at,updated_at) VALUES(9001,9001,9001,'PRAYER','Synthetic care',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP); INSERT INTO student_care_changes(record_id,actor_id,action,occurred_at) VALUES(9001,9001,'CREATED',CURRENT_TIMESTAMP)");
   String scope=Files.readString(Path.of("db/privacy/content-scope.sql")).trim();assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM ("+scope+") s WHERE table_name='student_care_records' AND column_name='content'"));
   assertThrows(SQLException.class,()->s.execute("UPDATE student_care_records SET kind='INVALID' WHERE id=9001"));
   s.execute("DELETE FROM users WHERE id=9001");assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM student_care_records WHERE author_id IS NULL AND content='Synthetic care'"));assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM student_care_changes WHERE actor_id IS NULL"));
   s.execute("UPDATE student_care_records SET content='' WHERE id=9001"); // reviewed privacy erasure remains possible
   assertThrows(SQLException.class,()->s.execute(sql));s.execute("ROLLBACK");
  }
  try(var app=app(url,user,"validate")){assertTrue(app.isActive());}
 }
 private org.springframework.context.ConfigurableApplicationContext app(String url,String user,String ddl){return new SpringApplicationBuilder(NewaveFlowApplication.class).profiles("prod").run("--server.address=127.0.0.1","--server.port=0","--spring.datasource.url="+url,"--spring.datasource.username="+user,"--spring.datasource.password="+System.getenv().getOrDefault("MIGRATION_TEST_PASSWORD",""),"--spring.jpa.hibernate.ddl-auto="+ddl,"--app.seed.enabled=false","--app.review.mode=false","--kakao.enabled=false","--apple.enabled=false","--push.enabled=false","--jwt.secret="+UUID.randomUUID()+UUID.randomUUID(),"--spring.main.banner-mode=off","--logging.level.root=ERROR");}
}
