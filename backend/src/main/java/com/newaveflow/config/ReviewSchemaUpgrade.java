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
    }
}
