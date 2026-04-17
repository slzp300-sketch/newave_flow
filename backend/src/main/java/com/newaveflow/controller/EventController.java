package com.newaveflow.controller;

import com.newaveflow.dto.event.EventDto.EventAttendanceRequest;
import com.newaveflow.dto.event.EventDto.EventResponse;
import com.newaveflow.entity.User;
import com.newaveflow.service.EventService;
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
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    @GetMapping
    public ResponseEntity<List<EventResponse>> getEvents(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(eventService.getEvents(from, to));
    }

    @GetMapping("/{id}")
    public ResponseEntity<EventResponse> getEvent(@PathVariable Long id) {
        return ResponseEntity.ok(eventService.getEvent(id));
    }

    @PostMapping("/{id}/attendance")
    public ResponseEntity<Map<String, Boolean>> saveAttendance(
            @PathVariable Long id,
            @Valid @RequestBody EventAttendanceRequest request,
            @AuthenticationPrincipal User currentUser) {
        
        eventService.saveEventAttendance(id, currentUser.getId(), request);
        return ResponseEntity.ok(Map.of("saved", true));
    }
}
