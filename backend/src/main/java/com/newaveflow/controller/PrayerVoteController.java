package com.newaveflow.controller;

import com.newaveflow.dto.prayer.PrayerVoteResponse;
import com.newaveflow.entity.PrayerVote;
import com.newaveflow.entity.User;
import com.newaveflow.service.PrayerVoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/prayer-votes")
@RequiredArgsConstructor
public class PrayerVoteController {

    private final PrayerVoteService prayerVoteService;

    // 투표 가능 여부 확인
    @GetMapping("/window")
    public ResponseEntity<Map<String, Object>> checkWindow() {
        LocalDate today = LocalDate.now();
        return ResponseEntity.ok(Map.of(
                "open", PrayerVoteService.isVoteWindowOpen(today),
                "weekStart", PrayerVoteService.getWeekStart(today)
        ));
    }

    // 내 투표 조회
    @GetMapping("/mine")
    public ResponseEntity<PrayerVoteResponse> getMyVote(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate week,
            @AuthenticationPrincipal User currentUser) {
        LocalDate weekStart = week != null ? week : PrayerVoteService.getWeekStart(LocalDate.now());
        return prayerVoteService.getMyVote(currentUser.getId(), weekStart)
                .map(vote -> ResponseEntity.ok(new PrayerVoteResponse(vote)))
                .orElse(ResponseEntity.noContent().build());
    }

    // 투표 저장/수정
    @PostMapping
    public ResponseEntity<PrayerVoteResponse> saveVote(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User currentUser) {
        String statusStr = body.get("status");
        if (statusStr == null || statusStr.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            LocalDate weekStart = LocalDate.parse(body.get("weekStart"));
            String reason = body.getOrDefault("reason", "");
            PrayerVote vote = prayerVoteService.saveVote(currentUser.getId(), weekStart, statusStr, reason);
            return ResponseEntity.ok(new PrayerVoteResponse(vote));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    // 관리자: 불참 명단 조회 (날짜별)
    @GetMapping("/absent")
    @PreAuthorize("hasAnyRole('ADMIN', 'PASTOR', 'EXECUTIVE')")
    public ResponseEntity<List<PrayerVoteResponse>> getAbsentList(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate week) {
        List<PrayerVoteResponse> responses = prayerVoteService.getAbsentListResponses(week);
        return ResponseEntity.ok(responses);
    }

    // 관리자: 필사 제출 여부 토글
    @PatchMapping("/{id}/scripture")
    @PreAuthorize("hasAnyRole('ADMIN', 'PASTOR', 'EXECUTIVE')")
    public ResponseEntity<PrayerVoteResponse> toggleScripture(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body) {
        boolean submitted = Boolean.TRUE.equals(body.get("submitted"));
        PrayerVote vote = prayerVoteService.toggleScriptureSubmitted(id, submitted);
        return ResponseEntity.ok(new PrayerVoteResponse(vote));
    }
}
