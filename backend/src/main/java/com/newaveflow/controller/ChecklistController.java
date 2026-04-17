package com.newaveflow.controller;

import com.newaveflow.dto.checklist.ChecklistDto.BatchRequest;
import com.newaveflow.dto.checklist.ChecklistDto.ItemResponse;
import com.newaveflow.dto.checklist.ChecklistDto.RecordResponse;
import com.newaveflow.entity.User;
import com.newaveflow.service.ChecklistService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/checklist")
@RequiredArgsConstructor
public class ChecklistController {

    private final ChecklistService checklistService;

    @GetMapping("/items")
    public ResponseEntity<List<ItemResponse>> getItems() {
        return ResponseEntity.ok(checklistService.getAllItems());
    }

    @GetMapping("/records")
    public ResponseEntity<List<RecordResponse>> getRecords(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        
        LocalDate targetDate = (date != null) ? date : LocalDate.now();
        return ResponseEntity.ok(checklistService.getRecordsByTeacherAndDate(currentUser.getId(), targetDate));
    }

    @PostMapping("/records")
    public ResponseEntity<Map<String, Object>> saveRecords(
            @Valid @RequestBody BatchRequest request,
            @AuthenticationPrincipal User currentUser) {
            
        int saved = checklistService.saveBatch(request, currentUser.getId());
        return ResponseEntity.ok(Map.of("saved", saved));
    }
}
