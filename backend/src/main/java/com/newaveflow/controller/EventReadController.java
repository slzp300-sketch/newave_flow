package com.newaveflow.controller;

import com.newaveflow.entity.User;
import com.newaveflow.service.EventReadService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController @RequestMapping("/api/event-reads") @RequiredArgsConstructor
public class EventReadController {
    private final EventReadService service;
    public record ReadRequest(@NotNull @Pattern(regexp = "[a-f0-9]{64}") String version) {}

    @GetMapping
    public Map<Long, String> getReads(@AuthenticationPrincipal User user) {
        return service.getReads(user.getId());
    }
    @PutMapping("/{eventId}")
    public Map<Long, String> acknowledge(@AuthenticationPrincipal User user, @PathVariable Long eventId,
            @Valid @RequestBody ReadRequest request) {
        return service.acknowledge(user.getId(), eventId, request.version());
    }
}
