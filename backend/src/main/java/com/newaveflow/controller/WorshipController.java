package com.newaveflow.controller;
import com.newaveflow.entity.User;
import com.newaveflow.service.WorshipService;
import com.newaveflow.service.WorshipService.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import java.time.LocalDate;
@RestController @RequestMapping("/api/worship") @RequiredArgsConstructor
public class WorshipController {
 private final WorshipService service;
 private ResponseEntity<State> response(State value){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value);}
 @GetMapping public ResponseEntity<State> state(@RequestParam(required=false) LocalDate date,@AuthenticationPrincipal User u){return response(service.state(date,u));}
 @PutMapping("/team") public ResponseEntity<State> team(@RequestParam(required=false) LocalDate date,@RequestBody MemberInput in,@AuthenticationPrincipal User u){return response(service.members(date,in,u));}
 @PutMapping("/{date}/committee") public ResponseEntity<State> committee(@PathVariable LocalDate date,@RequestBody CommitteeInput in,@AuthenticationPrincipal User u){return response(service.committee(date,in,u));}
 @PutMapping("/{date}/announcement") public ResponseEntity<State> announcement(@PathVariable LocalDate date,@RequestBody CheckInput in,@AuthenticationPrincipal User u){return response(service.announce(date,in,u));}
 @PutMapping("/{date}/tasks/{key}/check") public ResponseEntity<State> check(@PathVariable LocalDate date,@PathVariable String key,@RequestBody CheckInput in,@AuthenticationPrincipal User u){return response(service.check(date,key,false,in,u));}
 @PutMapping("/{date}/tasks/{key}/review") public ResponseEntity<State> review(@PathVariable LocalDate date,@PathVariable String key,@RequestBody CheckInput in,@AuthenticationPrincipal User u){return response(service.check(date,key,true,in,u));}
 @PutMapping("/{date}/tasks/{key}/assignee") public ResponseEntity<State> assign(@PathVariable LocalDate date,@PathVariable String key,@RequestBody AssignInput in,@AuthenticationPrincipal User u){return response(service.assign(date,key,in,u));}
}
