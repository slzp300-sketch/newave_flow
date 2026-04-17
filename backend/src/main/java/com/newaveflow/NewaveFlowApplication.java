package com.newaveflow;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class NewaveFlowApplication {
    public static void main(String[] args) {
        SpringApplication.run(NewaveFlowApplication.class, args);
    }
}
