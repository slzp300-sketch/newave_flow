package com.newaveflow.controller;

import com.newaveflow.dto.tts.TtsAnswerRequest;
import com.newaveflow.dto.tts.TtsResponse;
import com.newaveflow.dto.tts.TtsSubmitRequest;
import com.newaveflow.entity.TtsQuestion;
import com.newaveflow.entity.User;
import com.newaveflow.service.TtsService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tts")
@RequiredArgsConstructor
public class TtsController {

    private final TtsService ttsService;

    @GetMapping("/questions")
    public ResponseEntity<List<TtsQuestion>> getQuestions() {
        return ResponseEntity.ok(ttsService.getActiveQuestions());
    }

    @GetMapping("/my")
    public ResponseEntity<TtsResponse> getMyTts(
            @RequestParam Integer year,
            @RequestParam Integer weekNum,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(ttsService.getMyTtsRecord(currentUser, year, weekNum));
    }

    @PostMapping("/submit")
    public ResponseEntity<TtsResponse> submitTts(
            @RequestBody TtsSubmitRequest request,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(ttsService.submitTts(currentUser, request));
    }

    // 해당 날짜가 속한 주(일~토)의 내 체크 현황
    @GetMapping("/week")
    public ResponseEntity<TtsResponse> getWeek(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(ttsService.getWeek(currentUser, date != null ? date : LocalDate.now()));
    }

    // 항목 하나 탭할 때마다 바로 저장
    @PutMapping("/answer")
    public ResponseEntity<TtsResponse> saveAnswer(
            @RequestBody TtsAnswerRequest request,
            @AuthenticationPrincipal User currentUser) {
        try {
            return ResponseEntity.ok(ttsService.saveAnswer(currentUser, request));
        } catch (DataIntegrityViolationException e) {
            // 같은 주 첫 저장이 동시에 들어와 기록이 겹친 경우: 이미 생긴 기록에 한 번 더 저장
            return ResponseEntity.ok(ttsService.saveAnswer(currentUser, request));
        }
    }

    // 모든 교사가 보는 통계 (주차별 점수)
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats(@RequestParam Integer year) {
        return ResponseEntity.ok(ttsService.getStats(year));
    }

    @GetMapping("/window")
    public ResponseEntity<Map<String, Boolean>> checkWindow() {
        return ResponseEntity.ok(Map.of("open", ttsService.isSubmissionWindowOpen()));
    }
}
