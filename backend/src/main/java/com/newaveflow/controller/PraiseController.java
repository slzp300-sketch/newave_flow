package com.newaveflow.controller;
import com.newaveflow.entity.User;
import com.newaveflow.service.PraiseService;
import com.newaveflow.service.PraiseService.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.*;
import org.springframework.web.multipart.MultipartFile;

@RestController @RequestMapping("/api/praise") @RequiredArgsConstructor
public class PraiseController {
 private final PraiseService service;
 @GetMapping public State state(@RequestParam(required=false) Long term,@AuthenticationPrincipal User u){return service.state(term,u);}
 @PostMapping("/terms") public State create(@RequestBody TermInput in,@AuthenticationPrincipal User u){return service.create(in,u);}
 @PutMapping("/terms/{id}/members") public State member(@PathVariable Long id,@RequestBody MemberInput in,@AuthenticationPrincipal User u){return service.member(id,in,u);}
 @PutMapping("/terms/{id}/members/batch") public State members(@PathVariable Long id,@RequestBody BulkMembersInput in,@AuthenticationPrincipal User u){return service.members(id,in,u);}
 @PostMapping("/terms/{id}/weeks") public State generate(@PathVariable Long id,@RequestBody MonthInput in,@AuthenticationPrincipal User u){return service.generate(id,in,u);}
 @PutMapping("/terms/{id}/weeks/{week}") public State week(@PathVariable Long id,@PathVariable Long week,@RequestBody WeekInput in,@AuthenticationPrincipal User u){return service.week(id,week,in,u);}
 @PutMapping("/terms/{id}/publish") public State publish(@PathVariable Long id,@RequestBody MonthInput in,@AuthenticationPrincipal User u){return service.publish(id,in,u);}
 @PutMapping("/terms/{id}/availability") public State response(@PathVariable Long id,@RequestBody ResponseInput in,@AuthenticationPrincipal User u){return service.respond(id,in,u);}
 @PutMapping("/terms/{id}/prayer") public State prayer(@PathVariable Long id,@RequestBody PrayerInput in,@AuthenticationPrincipal User u){return service.prayer(id,in,u);}
 @PostMapping("/terms/{id}/weeks/{week}/pdf") public State upload(@PathVariable Long id,@PathVariable Long week,@RequestParam Long revision,@RequestParam MultipartFile file,@AuthenticationPrincipal User u){return service.upload(id,week,revision,file,u);}
 @GetMapping("/pdf/{id}") public ResponseEntity<byte[]> download(@PathVariable Long id,@AuthenticationPrincipal User u){var p=service.download(id,u);return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\"praise-"+p.getWeek().getWorshipDate()+"-v"+p.getFileVersion()+".pdf\"").header(HttpHeaders.CACHE_CONTROL,"no-store").header("X-Content-Type-Options","nosniff").body(p.getContent());}
 @GetMapping("/pdf/{id}/pages/{page}") public ResponseEntity<byte[]> page(@PathVariable Long id,@PathVariable int page,@AuthenticationPrincipal User u){return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).header(HttpHeaders.CACHE_CONTROL,"no-store").header("X-Content-Type-Options","nosniff").body(service.page(id,page,u));}
}
