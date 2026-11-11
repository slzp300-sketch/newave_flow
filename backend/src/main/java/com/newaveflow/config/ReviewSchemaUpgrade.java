package com.newaveflow.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Hibernate update adds columns but does not relax an existing H2 NOT NULL constraint. */
@Component @Profile("review") @Order(0) @RequiredArgsConstructor
public class ReviewSchemaUpgrade implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    @Override public void run(ApplicationArguments args) {
        // ReviewEnvironmentGuard rejects production connections before this bean can run.
        jdbc.execute("ALTER TABLE students ALTER COLUMN class_group_id DROP NOT NULL");
        // Match V023/V024 for the durable synthetic H2 database. PostgreSQL uses explicit migrations.
        if (hasTable("INTERCESSION_MEETINGS")) {
            jdbc.execute("ALTER TABLE intercession_meetings ADD COLUMN IF NOT EXISTS canceled boolean DEFAULT false NOT NULL");
            jdbc.execute("ALTER TABLE intercession_meetings ADD COLUMN IF NOT EXISTS cancellation_reason varchar(120) DEFAULT '' NOT NULL");
            jdbc.update("UPDATE intercession_meetings SET start_time=TIME '21:30' WHERE start_time IS DISTINCT FROM TIME '21:30'");
        }
        if (hasTable("INTERCESSION_REQUESTS")) {
            jdbc.execute("ALTER TABLE intercession_requests ADD COLUMN IF NOT EXISTS prayer_completed boolean DEFAULT false NOT NULL");
            jdbc.update("UPDATE intercession_requests SET prayer_completed=true WHERE status='ANSWERED' AND prayer_completed=false");
        }
    }

    private boolean hasTable(String name) {
        return jdbc.queryForObject("SELECT count(*) FROM information_schema.tables WHERE table_schema='PUBLIC' AND table_name=?", Integer.class, name)>0;
    }
}
