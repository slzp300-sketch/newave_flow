package com.newaveflow;

import com.newaveflow.config.ReviewSchemaUpgrade;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class ReviewSchemaUpgradeTest {
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
