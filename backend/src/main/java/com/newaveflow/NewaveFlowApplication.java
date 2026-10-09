package com.newaveflow;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableJpaAuditing
@EnableScheduling
public class NewaveFlowApplication {
    public static void main(String[] args) {
        // 제출 마감(출석·TTS·모임) 판단이 서버 위치와 무관하게 한국 시간 기준이 되도록 고정
        java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("Asia/Seoul"));
        SpringApplication.run(NewaveFlowApplication.class, args);
    }
}
