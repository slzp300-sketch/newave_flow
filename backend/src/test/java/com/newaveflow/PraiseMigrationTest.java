package com.newaveflow;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
@EnabledIfEnvironmentVariable(named="RUN_PRAISE_MIGRATION",matches="true")
class PraiseMigrationTest {
 @Test void migrationRollbackValidationAndAccountReferences()throws Exception {
  String url=System.getenv("PRAISE_TEST_JDBC_URL"),user=System.getenv("MIGRATION_TEST_USER");
  assertNotNull(url);assertTrue(url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/newave_praise_[a-z0-9_]+"));
  try(var app=app(url,user,"create")){assertTrue(app.isActive());}
  try(var c=DriverManager.getConnection(url,user,System.getenv().getOrDefault("MIGRATION_TEST_PASSWORD",""));var s=c.createStatement()){
   s.execute("DROP TABLE praise_pdfs,praise_prayers,praise_responses,praise_weeks,praise_members,praise_terms");
   s.execute("CREATE TABLE schema_migrations(version varchar(80) PRIMARY KEY,applied_at timestamp DEFAULT CURRENT_TIMESTAMP); INSERT INTO schema_migrations(version) VALUES('V020__officer_organization')");
   s.execute("INSERT INTO users(id,name,email,role,is_active,is_suspended,auth_version,large_font,new_family_team,organization_executive) VALUES(9001,'Synthetic praise','praise@example.invalid','TEACHER',true,false,0,false,false,false)");
   var before=EventReadMigrationTest.fingerprints(c);String sql=Files.readString(Path.of("db/migrations/V021__praise_team.sql"));
   assertThrows(SQLException.class,()->s.execute(sql.replace("INSERT INTO schema_migrations","SELECT 1/0; INSERT INTO schema_migrations")));s.execute("ROLLBACK");assertEquals(before,EventReadMigrationTest.fingerprints(c));
   s.execute(sql);
   s.execute("INSERT INTO praise_terms(id,term_year,half) VALUES(1,2026,2); INSERT INTO praise_members(id,term_id,user_id,parts) VALUES(1,1,9001,'[\"인도자\"]'); INSERT INTO praise_weeks(id,term_id,worship_date,practice_date,start_time,end_time) VALUES(1,1,'2026-12-06','2026-12-05','17:00','19:00'); INSERT INTO praise_responses(term_id,user_id,response_month,submitted_at) VALUES(1,9001,'2026-12',CURRENT_TIMESTAMP); INSERT INTO praise_pdfs(week_id,file_version,content,uploaded_by_id,uploaded_at,page_count) VALUES(1,1,decode('255044462d','hex'),9001,CURRENT_TIMESTAMP,1)");
   assertThrows(SQLException.class,()->s.execute("INSERT INTO praise_members(term_id,user_id,parts) VALUES(1,9001,'[]')"));
   s.execute("DELETE FROM users WHERE id=9001");assertEquals("0",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM praise_responses"));assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM praise_members WHERE user_id IS NULL"));assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM praise_pdfs WHERE uploaded_by_id IS NULL"));
   assertThrows(SQLException.class,()->s.execute(sql));s.execute("ROLLBACK");
  }
  try(var app=app(url,user,"validate")){assertTrue(app.isActive());}
 }
 private org.springframework.context.ConfigurableApplicationContext app(String url,String user,String ddl){return new SpringApplicationBuilder(NewaveFlowApplication.class).profiles("prod").run("--server.address=127.0.0.1","--server.port=0","--spring.datasource.url="+url,"--spring.datasource.username="+user,"--spring.datasource.password="+System.getenv().getOrDefault("MIGRATION_TEST_PASSWORD",""),"--spring.jpa.hibernate.ddl-auto="+ddl,"--app.seed.enabled=false","--kakao.enabled=false","--jwt.secret="+UUID.randomUUID()+UUID.randomUUID(),"--spring.main.banner-mode=off","--logging.level.root=ERROR");}
}
