package com.newaveflow.controller;

import com.newaveflow.entity.*;
import com.newaveflow.service.CommunitySafetyService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api/safety") @RequiredArgsConstructor
public class CommunitySafetyController {
    private final CommunitySafetyService safety;
    @GetMapping("/policy") public CommunitySafetyService.Policy policy() { return safety.policy(); }
    @GetMapping("/agreement") public CommunitySafetyService.AgreementView agreement(@AuthenticationPrincipal User user) { return safety.agreement(user.getId()); }
    public record AcceptRequest(@NotBlank String version, boolean accepted) {}
    @PostMapping("/agreement") public CommunitySafetyService.AgreementView accept(@AuthenticationPrincipal User user, @Valid @RequestBody AcceptRequest request) {
        return safety.accept(user.getId(), request.version(), request.accepted());
    }
    @GetMapping("/users") public List<Map<String, Object>> users() { return safety.reportableUsers(); }
    @PostMapping("/reports") public CommunitySafetyService.ReportView report(@AuthenticationPrincipal User user,
        @Valid @RequestBody CommunitySafetyService.ReportRequest request) { return safety.create(user, request); }
    @GetMapping("/reports") public Page<CommunitySafetyService.ReportView> myReports(@AuthenticationPrincipal User user, @RequestParam(defaultValue = "0") int page) {
        return safety.list(user, false, null, page);
    }
    @GetMapping("/admin/reports") @PreAuthorize("hasAnyRole('ADMIN','PASTOR','EXECUTIVE')")
    public Page<CommunitySafetyService.ReportView> reports(@AuthenticationPrincipal User user, @RequestParam(defaultValue = "0") int page,
        @RequestParam(required = false) ContentReport.Status status) { return safety.list(user, true, status, page); }
    @PatchMapping("/admin/reports/{id}") @PreAuthorize("hasAnyRole('ADMIN','PASTOR','EXECUTIVE')")
    public CommunitySafetyService.ReportView resolve(@AuthenticationPrincipal User user, @PathVariable Long id,
        @Valid @RequestBody CommunitySafetyService.ResolveRequest request) { return safety.resolve(user, id, request); }
}
