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
    private final com.newaveflow.service.PhotoModerationService photos;
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
    @GetMapping("/admin/summary") @PreAuthorize("hasAnyRole('ADMIN','PASTOR','EXECUTIVE')")
    public CommunitySafetyService.QueueSummary summary(@AuthenticationPrincipal User user) { return safety.summary(user); }
    @PatchMapping("/admin/reports/{id}/assignment") @PreAuthorize("hasAnyRole('ADMIN','PASTOR','EXECUTIVE')")
    public CommunitySafetyService.ReportView assign(@AuthenticationPrincipal User user,@PathVariable Long id,
        @Valid @RequestBody CommunitySafetyService.AssignmentRequest request) { return safety.assign(user,id,request); }
    @GetMapping("/admin/reports/{id}/target") @PreAuthorize("hasAnyRole('ADMIN','PASTOR','EXECUTIVE')")
    public CommunitySafetyService.TargetView target(@AuthenticationPrincipal User user,@PathVariable Long id) { return safety.target(user,id); }
    @GetMapping("/admin/photos") @PreAuthorize("hasAnyRole('ADMIN','PASTOR','EXECUTIVE')")
    public Page<com.newaveflow.service.PhotoModerationService.PhotoView> photos(@AuthenticationPrincipal User user,
        @RequestParam(defaultValue="PENDING") ModeratedPhoto.Status status,@RequestParam(defaultValue="0") int page) { return photos.list(user,status,page); }
    @GetMapping("/admin/photos/{id}/image") @PreAuthorize("hasAnyRole('ADMIN','PASTOR','EXECUTIVE')")
    public Map<String,Object> photoImage(@AuthenticationPrincipal User user,@PathVariable Long id) { return photos.image(user,id); }
    @PatchMapping("/admin/photos/{id}") @PreAuthorize("hasAnyRole('ADMIN','PASTOR','EXECUTIVE')")
    public com.newaveflow.service.PhotoModerationService.PhotoView reviewPhoto(@AuthenticationPrincipal User user,@PathVariable Long id,
        @Valid @RequestBody com.newaveflow.service.PhotoModerationService.ReviewRequest request) { return photos.review(user,id,request); }
    @GetMapping("/photos/status") public org.springframework.http.ResponseEntity<com.newaveflow.service.PhotoModerationService.PhotoView> photoStatus(
        @AuthenticationPrincipal User user,@RequestParam ModeratedPhoto.TargetType targetType,@RequestParam Long targetId) {
        var result=photos.status(user,targetType,targetId);
        return result==null?org.springframework.http.ResponseEntity.noContent().build():org.springframework.http.ResponseEntity.ok(result);
    }
    @DeleteMapping("/photos") public org.springframework.http.ResponseEntity<Void> removePhoto(@AuthenticationPrincipal User user,
        @RequestParam ModeratedPhoto.TargetType targetType,@RequestParam Long targetId) {
        photos.remove(user,targetType,targetId); return org.springframework.http.ResponseEntity.noContent().build();
    }
}
