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
   s.execute("UPDATE intercession_meetings SET start_time=NULL,revision=7,selected_ids='[42]',paper='[]'");
   String preservedColumns="SELECT concat_ws('|',meeting_date,duration,host_id,zoom_url,revision,selected_ids,paper,prepared_at) FROM intercession_meetings";
   var preserved=EventReadMigrationTest.scalar(c,preservedColumns);
   var beforeSchedule=EventReadMigrationTest.fingerprints(c);
   String schedule=Files.readString(Path.of("db/migrations/V023__intercession_schedule.sql"));
   assertThrows(SQLException.class,()->s.execute(schedule.replace("INSERT INTO schema_migrations","SELECT 1/0; INSERT INTO schema_migrations")));s.execute("ROLLBACK");
   assertEquals(beforeSchedule,EventReadMigrationTest.fingerprints(c));
   s.execute(schedule);
   assertEquals(preserved,EventReadMigrationTest.scalar(c,preservedColumns));
   assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM intercession_meetings WHERE start_time=TIME '21:30' AND canceled=false AND cancellation_reason=''"));
   var afterSchedule=EventReadMigrationTest.fingerprints(c);
   for(String table:List.of("intercession_meetings","schema_migrations")){beforeSchedule.remove(table);afterSchedule.remove(table);}
   assertEquals(beforeSchedule,afterSchedule);
   s.execute("INSERT INTO intercession_meetings(meeting_date) VALUES('2026-11-03')");
   assertEquals("2",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM intercession_meetings WHERE start_time=TIME '21:30' AND canceled=false"));
   assertThrows(SQLException.class,()->s.execute(schedule));s.execute("ROLLBACK");
   for(String status:List.of("PENDING","READY","PUBLISHED","ANSWERED","ARCHIVED"))s.execute("INSERT INTO intercession_requests(title,body,category,source,share,anonymous,status,created_at,updated_at) VALUES('Synthetic completion','Synthetic original','기타','앱',true,true,'"+status+"',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
   String originals="SELECT md5(string_agg(row(id,title,body,share,anonymous,status,revision,created_at,updated_at)::text,'|' ORDER BY id)) FROM intercession_requests";
   var originalRequests=EventReadMigrationTest.scalar(c,originals);var beforeCompletion=EventReadMigrationTest.fingerprints(c);
   String completion=Files.readString(Path.of("db/migrations/V024__intercession_prayer_completion.sql"));
   assertThrows(SQLException.class,()->s.execute(completion.replace("INSERT INTO schema_migrations","SELECT 1/0; INSERT INTO schema_migrations")));s.execute("ROLLBACK");
   assertEquals(beforeCompletion,EventReadMigrationTest.fingerprints(c));s.execute(completion);
   assertEquals(originalRequests,EventReadMigrationTest.scalar(c,originals));
   assertEquals("1",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM intercession_requests WHERE prayer_completed=true AND status='ANSWERED'"));
   assertEquals("4",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM intercession_requests WHERE prayer_completed=false AND status<>'ANSWERED'"));
   var afterCompletion=EventReadMigrationTest.fingerprints(c);
   for(String table:List.of("intercession_requests","schema_migrations")){beforeCompletion.remove(table);afterCompletion.remove(table);}
   assertEquals(beforeCompletion,afterCompletion);
   assertThrows(SQLException.class,()->s.execute(completion));s.execute("ROLLBACK");
   var beforeUpdates=EventReadMigrationTest.fingerprints(c);
   String updates=Files.readString(Path.of("db/migrations/V025__intercession_request_updates.sql"));
   assertThrows(SQLException.class,()->s.execute(updates.replace("INSERT INTO schema_migrations","SELECT 1/0; INSERT INTO schema_migrations")));s.execute("ROLLBACK");
   assertEquals(beforeUpdates,EventReadMigrationTest.fingerprints(c));s.execute(updates);
   assertEquals(originalRequests,EventReadMigrationTest.scalar(c,originals));
   assertEquals("5",EventReadMigrationTest.scalar(c,"SELECT count(*) FROM intercession_requests WHERE pending_update IS NULL AND update_history='[]'"));
   var afterUpdates=EventReadMigrationTest.fingerprints(c);
   for(String table:List.of("intercession_requests","schema_migrations")){beforeUpdates.remove(table);afterUpdates.remove(table);}
   assertEquals(beforeUpdates,afterUpdates);
   assertThrows(SQLException.class,()->s.execute(updates));s.execute("ROLLBACK");
  }
  try(var app=app(url,user,"validate")){assertTrue(app.isActive());}
 }
 private org.springframework.context.ConfigurableApplicationContext app(String url,String user,String ddl){return new SpringApplicationBuilder(NewaveFlowApplication.class).profiles("prod").run("--server.address=127.0.0.1","--server.port=0","--spring.datasource.url="+url,"--spring.datasource.username="+user,"--spring.datasource.password="+System.getenv().getOrDefault("MIGRATION_TEST_PASSWORD",""),"--spring.jpa.hibernate.ddl-auto="+ddl,"--app.seed.enabled=false","--kakao.enabled=false","--jwt.secret="+UUID.randomUUID()+UUID.randomUUID(),"--spring.main.banner-mode=off","--logging.level.root=ERROR");}
}
