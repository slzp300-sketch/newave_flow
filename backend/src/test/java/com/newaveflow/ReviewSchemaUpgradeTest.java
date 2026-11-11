package com.newaveflow;

import com.newaveflow.config.ReviewSchemaUpgrade;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class ReviewSchemaUpgradeTest {
    @Test void populatedPrayerTablesUpgradeWithoutLosingContentAndRestartKeepsTeamDecisions() {
        var data = new DriverManagerDataSource("jdbc:h2:mem:review_prayer_upgrade_"+UUID.randomUUID()+";DB_CLOSE_DELAY=-1", "sa", "");
        var jdbc = new JdbcTemplate(data);
        try {
            jdbc.execute("CREATE TABLE students(id bigint PRIMARY KEY,class_group_id bigint)");
            jdbc.execute("CREATE TABLE intercession_meetings(meeting_date date PRIMARY KEY,start_time time,duration int,revision bigint)");
            jdbc.execute("CREATE TABLE intercession_requests(id bigint PRIMARY KEY,status varchar(12),body text,revision bigint)");
            jdbc.update("INSERT INTO intercession_meetings VALUES(DATE '2026-11-05',TIME '22:00',45,7)");
            jdbc.update("INSERT INTO intercession_requests VALUES(1,'ANSWERED','Synthetic past request',5),(2,'PUBLISHED','Synthetic current request',3)");
            var upgrade=new ReviewSchemaUpgrade(jdbc);upgrade.run(null);
            assertEquals("21:30:00",jdbc.queryForObject("SELECT start_time FROM intercession_meetings",String.class));
            assertFalse(jdbc.queryForObject("SELECT canceled FROM intercession_meetings",Boolean.class));
            assertTrue(jdbc.queryForObject("SELECT prayer_completed FROM intercession_requests WHERE id=1",Boolean.class));
            assertFalse(jdbc.queryForObject("SELECT prayer_completed FROM intercession_requests WHERE id=2",Boolean.class));
            jdbc.update("UPDATE intercession_meetings SET canceled=true,cancellation_reason='교회 행사'");
            jdbc.update("UPDATE intercession_requests SET status='PUBLISHED',prayer_completed=false WHERE id=1");
            jdbc.update("UPDATE intercession_requests SET status='READY',prayer_completed=true WHERE id=2");
            upgrade.run(null);
            assertTrue(jdbc.queryForObject("SELECT canceled FROM intercession_meetings",Boolean.class));
            assertEquals("교회 행사",jdbc.queryForObject("SELECT cancellation_reason FROM intercession_meetings",String.class));
            assertFalse(jdbc.queryForObject("SELECT prayer_completed FROM intercession_requests WHERE id=1",Boolean.class));
            assertTrue(jdbc.queryForObject("SELECT prayer_completed FROM intercession_requests WHERE id=2",Boolean.class));
            assertEquals("Synthetic past request",jdbc.queryForObject("SELECT body FROM intercession_requests WHERE id=1",String.class));
            assertEquals(5L,jdbc.queryForObject("SELECT revision FROM intercession_requests WHERE id=1",Long.class));
            assertEquals(7L,jdbc.queryForObject("SELECT revision FROM intercession_meetings",Long.class));
        } finally {jdbc.execute("DROP ALL OBJECTS");}
    }
    @Test void existingReviewStudentsSurviveUpgradeAndNewcomersCanRemainUnassigned() {
        var data = new DriverManagerDataSource("jdbc:h2:mem:review_upgrade_"+UUID.randomUUID()+";DB_CLOSE_DELAY=-1", "sa", "");
        var jdbc = new JdbcTemplate(data);
        try {
            jdbc.execute("CREATE TABLE class_groups(id bigint PRIMARY KEY)");
            jdbc.execute("CREATE TABLE students(id bigint PRIMARY KEY, name varchar(80) NOT NULL, class_group_id bigint NOT NULL REFERENCES class_groups(id))");
            jdbc.update("INSERT INTO class_groups VALUES(11)");
            jdbc.update("INSERT INTO students VALUES(1,'Synthetic existing student',11)");
            assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> jdbc.update("INSERT INTO students VALUES(2,'Synthetic first visit',NULL)"));
            var upgrade = new ReviewSchemaUpgrade(jdbc);
            upgrade.run(null);
            upgrade.run(null); // Restarting the durable review database must remain safe.
            assertEquals(11L,jdbc.queryForObject("SELECT class_group_id FROM students WHERE id=1",Long.class));
            jdbc.update("INSERT INTO students VALUES(2,'Synthetic first visit',NULL)");
            assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM students",Integer.class));
            assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> jdbc.update("UPDATE students SET class_group_id=999 WHERE id=2"));
        } finally { jdbc.execute("DROP ALL OBJECTS"); }
    }
}
