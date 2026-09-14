package com.newaveflow.controller;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class HealthController {

    private final EntityManager entityManager;

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        // DB 커넥션 풀까지 준비됐는지 확인 — 콜드스타트 중이면 503을 반환해
        // 프론트엔드 워밍업이 완전히 준비될 때까지 재시도하게 한다
        try {
            entityManager.createNativeQuery("SELECT 1").getSingleResult();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("status", "db_not_ready"));
        }
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
