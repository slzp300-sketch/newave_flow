package com.newaveflow.controller;

import com.newaveflow.entity.User;
import com.newaveflow.service.StudentMemoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/students")
@RequiredArgsConstructor
public class StudentMemoController {

    private final StudentMemoService studentMemoService;

    public record MemoRequest(String prayerRequest, String sketch) {}

    @PutMapping("/{studentId}/memo")
    public ResponseEntity<Void> saveMemo(
            @PathVariable Long studentId,
            @RequestBody MemoRequest body,
            @AuthenticationPrincipal User currentUser) {
        studentMemoService.saveMemo(studentId, body.prayerRequest(), body.sketch(), currentUser);
        return ResponseEntity.ok().build();
    }
}
