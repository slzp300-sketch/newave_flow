package com.newaveflow;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
@EnabledIfEnvironmentVariable(named="RUN_INTERCESSION_MIGRATION",matches="true")
class IntercessionMigrationTest {
 @Test void rollbackPreservesExistingDataAndMigrationValidatesAgainstPostgres()throws Exception{
  String url=System.getenv("INTERCESSION_TEST_JDBC_URL"),user=System.getenv("MIGRATION_TEST_USER");
  assertNotNull(url);assertTrue(url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/newave_intercession_[a-z0-9_]+"));
  try(var app=app(url,user,"create")){assertTrue(app.isActive());}
  try(var c=DriverManager.getConnection(url,user,System.getenv().getOrDefault("MIGRATION_TEST_PASSWORD",""));var s=c.createStatement()){
   s.execute("DROP TABLE intercession_requests,intercession_members,intercession_meetings,intercession_registry");
   s.execute("CREATE TABLE schema_migrations(version varchar(80) PRIMARY KEY,applied_at timestamp DEFAULT CURRENT_TIMESTAMP); INSERT INTO schema_migrations(version) VALUES('V021__praise_team')");
   s.execute("INSERT INTO users(id,name,email,role,is_active,is_suspended,auth_version,large_font,new_family_team,organization_executive) VALUES(9001,'Synthetic intercession','intercession@example.invalid','TEACHER',true,false,0,false,false,false)");
   var before=EventReadMigrationTest.fingerprints(c);String sql=Files.readString(Path.of("db/migrations/V022__intercession_team.sql"));
   assertThrows(SQLException.class,()->s.execute(sql.replace("INSERT INTO schema_migrations","SELECT 1/0; INSERT INTO schema_migrations")));s.execute("ROLLBACK");assertEquals(before,EventReadMigrationTest.fingerprints(c));
   s.execute(sql);
   var after=EventReadMigrationTest.fingerprints(c);after.keySet().removeIf(k->k.startsWith("intercession_"));after.remove("schema_migrations");before.remove("schema_migrations");assertEquals(before,after);
   s.execute("INSERT INTO intercession_members(id) VALUES(9001); INSERT INTO intercession_requests(author_id,title,body,category,source,share,anonymous,created_at,updated_at) VALUES(9001,'Synthetic','Synthetic','기타','앱',true,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP); INSERT INTO intercession_meetings(meeting_date,host_id) VALUES('2026-11-05',9001)");
   assertThrows(SQLException.class,()->s.execute("INSERT INTO intercession_meetings(meeting_date) VALUES('2026-11-06')"));
   assertThrows(SQLException.class,()->s.execute("INSERT INTO intercession_members(id) VALUES(9001)"));
   s.execute("DELETE FROM users WHERE id=9001");
   assertEquals("0",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM intercession_members"));assertEquals("0",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM intercession_requests"));assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM intercession_meetings WHERE host_id IS NULL"));
   assertThrows(SQLException.class,()->s.execute(sql));s.execute("ROLLBACK");
  }
  try(var app=app(url,user,"validate")){assertTrue(app.isActive());}
 }
 private org.springframework.context.ConfigurableApplicationContext app(String url,String user,String ddl){return new SpringApplicationBuilder(NewaveFlowApplication.class).profiles("prod").run("--server.address=127.0.0.1","--server.port=0","--spring.datasource.url="+url,"--spring.datasource.username="+user,"--spring.datasource.password="+System.getenv().getOrDefault("MIGRATION_TEST_PASSWORD",""),"--spring.jpa.hibernate.ddl-auto="+ddl,"--app.seed.enabled=false","--kakao.enabled=false","--jwt.secret="+UUID.randomUUID()+UUID.randomUUID(),"--spring.main.banner-mode=off","--logging.level.root=ERROR");}
}
