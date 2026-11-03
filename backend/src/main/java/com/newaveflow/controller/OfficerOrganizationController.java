package com.newaveflow.controller;
import com.newaveflow.entity.*;
import com.newaveflow.service.OfficerOrganizationService;
import com.newaveflow.service.OfficerOrganizationService.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.access.prepost.PreAuthorize;
@RestController @RequestMapping("/api/officers") @RequiredArgsConstructor
public class OfficerOrganizationController {
    private final OfficerOrganizationService service;
    @GetMapping("/me") public Capability capability(@AuthenticationPrincipal User u) { return service.capability(u); }
    @GetMapping("/organization") public Organization organization(@RequestParam(required=false) Integer year,@AuthenticationPrincipal User u) { return service.get(year,u); }
    @PutMapping("/organization/{year}/{position}") @PreAuthorize("hasRole('ADMIN')")
    public Organization assign(@PathVariable int year,@PathVariable OfficerPosition position,@RequestBody Assignment body,@AuthenticationPrincipal User u) { return service.assign(year,position,body,u); }
    @PutMapping("/organization/{year}/activate") @PreAuthorize("hasRole('ADMIN')")
    public Organization activate(@PathVariable int year,@RequestBody Activation body,@AuthenticationPrincipal User u) { return service.activate(year,body,u); }
}
