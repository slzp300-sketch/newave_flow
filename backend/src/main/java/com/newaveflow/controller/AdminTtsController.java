package com.newaveflow.controller;

import com.newaveflow.entity.TtsQuestion;
import com.newaveflow.service.TtsService;
import com.newaveflow.service.TtsLegacyImportService;
import com.newaveflow.dto.tts.TtsImportRequest;
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
    private final TtsLegacyImportService importer;

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

    @PostMapping("/legacy/preview")
    public ResponseEntity<Map<String, Object>> previewLegacy(@RequestBody TtsImportRequest body) {
        return ResponseEntity.ok(importer.preview(body));
    }

    // 검증된 미리보기와 같은 내용으로 선택한 주차만 교체한다.
    @PostMapping("/legacy")
    public ResponseEntity<Map<String, Object>> importLegacy(@RequestBody TtsImportRequest body) {
        return ResponseEntity.ok(importer.apply(body));
    }
}
