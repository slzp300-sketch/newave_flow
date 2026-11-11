package com.newaveflow.controller;
import com.newaveflow.entity.User;
import com.newaveflow.service.IntercessionService;
import com.newaveflow.service.IntercessionService.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import java.time.LocalDate;
@RestController @RequestMapping("/api/intercession") @RequiredArgsConstructor
public class IntercessionController {
 private final IntercessionService service;
 private <T>ResponseEntity<T> response(T value){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value);}
 @GetMapping public ResponseEntity<State> state(@RequestParam(required=false) LocalDate week,@AuthenticationPrincipal User u){return response(service.state(week,u));}
 @PutMapping("/team") public ResponseEntity<State> members(@RequestBody MemberInput in,@AuthenticationPrincipal User u){return response(service.members(in,u));}
 @GetMapping("/requests") public ResponseEntity<RequestPage> list(@RequestParam(defaultValue="board") String scope,@RequestParam(defaultValue="all") String status,@RequestParam(defaultValue="") String search,@RequestParam(defaultValue="0") int page,@AuthenticationPrincipal User u){return response(service.list(scope,status,search,page,u));}
 @GetMapping("/requests/{id}") public ResponseEntity<RequestView> detail(@PathVariable Long id,@AuthenticationPrincipal User u){return response(service.detail(id,u));}
 @PostMapping("/requests") public ResponseEntity<RequestView> submit(@RequestBody RequestInput in,@AuthenticationPrincipal User u){return response(service.submit(in,u));}
 @PutMapping("/requests/{id}") public ResponseEntity<RequestView> review(@PathVariable Long id,@RequestBody ReviewInput in,@AuthenticationPrincipal User u){return response(service.review(id,in,u));}
 @PutMapping("/requests/{id}/decision") public ResponseEntity<RequestView> decide(@PathVariable Long id,@RequestBody DecisionInput in,@AuthenticationPrincipal User u){return response(service.decide(id,in,u));}
 @PutMapping("/requests/{id}/update") public ResponseEntity<RequestView> update(@PathVariable Long id,@RequestBody UpdateInput in,@AuthenticationPrincipal User u){return response(service.updateRequest(id,in,u));}
 @PutMapping("/requests/{id}/update-review") public ResponseEntity<RequestView> reviewUpdate(@PathVariable Long id,@RequestBody UpdateReviewInput in,@AuthenticationPrincipal User u){return response(service.reviewUpdate(id,in,u));}
 @PostMapping("/requests/{id}/withdraw") public ResponseEntity<RequestView> withdraw(@PathVariable Long id,@RequestBody Revision in,@AuthenticationPrincipal User u){return response(service.withdraw(id,in,u));}
 @PutMapping("/meetings/{date}") public ResponseEntity<State> meeting(@PathVariable LocalDate date,@RequestBody MeetingInput in,@AuthenticationPrincipal User u){return response(service.configure(date,in,u));}
 @PutMapping("/meetings/{date}/materials") public ResponseEntity<State> materials(@PathVariable LocalDate date,@RequestBody MaterialsInput in,@AuthenticationPrincipal User u){return response(service.materials(date,in,u));}
 @PostMapping("/meetings/{date}/paper") public ResponseEntity<State> paper(@PathVariable LocalDate date,@RequestBody Revision in,@AuthenticationPrincipal User u){return response(service.prepare(date,in,u));}
}
