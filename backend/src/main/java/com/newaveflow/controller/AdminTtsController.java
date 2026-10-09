package com.newaveflow.controller;

import com.newaveflow.entity.TtsQuestion;
import com.newaveflow.service.TtsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'PASTOR', 'EXECUTIVE')")
@RestController
@RequestMapping("/api/admin/tts")
@RequiredArgsConstructor
public class AdminTtsController {

    private final TtsService ttsService;

    @GetMapping("/summary")
    public ResponseEntity<List<Map<String, Object>>> getSummary(
            @RequestParam Integer year,
            @RequestParam Integer weekNum) {
        return ResponseEntity.ok(ttsService.getAdminSummary(year, weekNum));
    }

    @GetMapping("/scores/quarterly")
    public ResponseEntity<List<Map<String, Object>>> getQuarterlyScores(
            @RequestParam Integer year,
            @RequestParam Integer quarter) {
        return ResponseEntity.ok(ttsService.getQuarterlyScores(year, quarter));
    }

    @GetMapping("/questions")
    public ResponseEntity<List<TtsQuestion>> getAllQuestions() {
        return ResponseEntity.ok(ttsService.getAllQuestions());
    }

    @PostMapping("/questions")
    public ResponseEntity<List<TtsQuestion>> updateQuestions(@RequestBody List<TtsQuestion> questions) {
        return ResponseEntity.ok(ttsService.updateQuestions(questions));
    }

    // 구글 시트 "주차별점수" 표를 붙여넣어 해당 연도 기존 점수를 통째로 교체
    @PostMapping("/legacy")
    public ResponseEntity<Map<String, Object>> importLegacy(@RequestBody Map<String, Object> body) {
        int year = Integer.parseInt(String.valueOf(body.get("year")));
        return ResponseEntity.ok(ttsService.importLegacyScores(year, (String) body.get("text")));
    }
}
