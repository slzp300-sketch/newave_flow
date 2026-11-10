package com.newaveflow.controller;
import com.newaveflow.entity.User;
import com.newaveflow.service.GradeCareService;
import com.newaveflow.service.GradeCareService.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.Map;

@RestController @RequestMapping("/api/grade-care") @RequiredArgsConstructor
public class GradeCareController {
 private final GradeCareService service;
 private <T> ResponseEntity<T> response(T value){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value);}
 @GetMapping("/access") public ResponseEntity<Capability> access(@AuthenticationPrincipal User u){return response(service.capability(u));}
 @GetMapping public ResponseEntity<Overview> overview(@RequestParam String grade,@RequestParam(required=false) LocalDate date,@AuthenticationPrincipal User u){return response(service.overview(grade,date,u));}
 @GetMapping("/events/{id}") public ResponseEntity<EventCheck> event(@PathVariable Long id,@RequestParam String grade,@AuthenticationPrincipal User u){return response(service.event(id,grade,u));}
 @GetMapping("/students/{id}/access") public ResponseEntity<Map<String,Boolean>> studentAccess(@PathVariable Long id,@AuthenticationPrincipal User u){return response(Map.of("canCare",service.studentAccess(id,u)));}
 @GetMapping("/students/{id}") public ResponseEntity<Detail> detail(@PathVariable Long id,@RequestParam(required=false) LocalDate date,@AuthenticationPrincipal User u){return response(service.detail(id,date,u));}
 @PostMapping("/students/{id}/records") public ResponseEntity<CareNote> create(@PathVariable Long id,@RequestBody NoteInput in,@AuthenticationPrincipal User u){return response(service.create(id,in,u));}
 @PutMapping("/students/{id}/records/{recordId}") public ResponseEntity<CareNote> update(@PathVariable Long id,@PathVariable Long recordId,@RequestBody NoteInput in,@AuthenticationPrincipal User u){return response(service.update(id,recordId,in,u));}
}
