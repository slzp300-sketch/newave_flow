package com.newaveflow.controller;

import com.newaveflow.dto.tts.TtsResponse;
import com.newaveflow.dto.tts.TtsSubmitRequest;
import com.newaveflow.entity.TtsQuestion;
import com.newaveflow.entity.User;
import com.newaveflow.service.TtsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

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

    @GetMapping("/window")
    public ResponseEntity<Map<String, Boolean>> checkWindow() {
        return ResponseEntity.ok(Map.of("open", ttsService.isSubmissionWindowOpen()));
    }
}
