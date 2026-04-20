package com.newaveflow.controller;

import com.newaveflow.entity.TtsQuestion;
import com.newaveflow.service.TtsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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

    @PostMapping("/questions")
    public ResponseEntity<List<TtsQuestion>> updateQuestions(@RequestBody List<TtsQuestion> questions) {
        return ResponseEntity.ok(ttsService.updateQuestions(questions));
    }
}
