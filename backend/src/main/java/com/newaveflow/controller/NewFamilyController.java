package com.newaveflow.controller;
import com.newaveflow.dto.report.NewFamilyDto.*;
import com.newaveflow.entity.User;
import com.newaveflow.service.NewFamilyService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.*;
@RestController @RequestMapping("/api/new-family") @RequiredArgsConstructor
public class NewFamilyController {
    private final NewFamilyService service;
    @GetMapping("/students/{id}/handoff") public Handoff handoff(@PathVariable Long id,@AuthenticationPrincipal User u){return service.handoff(id,u);}
    @GetMapping("/capability") public Capability capability(@AuthenticationPrincipal User u){return service.capability(u);}
    @GetMapping("/team") public List<TeamUser> team(@AuthenticationPrincipal User u){return service.team(u);}
    @PutMapping("/team/{id}") public void team(@PathVariable Long id,@RequestBody TeamInput body,@AuthenticationPrincipal User u){service.setTeam(id,body,u);}
    @GetMapping("/people") public List<Person> people(@AuthenticationPrincipal User u){return service.roster(u);}
    @PostMapping("/people") public Person create(@RequestBody Create body,@AuthenticationPrincipal User u){return service.create(body,u);}
    @PutMapping("/people/{id}") public Person edit(@PathVariable Long id,@RequestBody Edit body,@AuthenticationPrincipal User u){return service.edit(id,body,u);}
    @PutMapping("/people/{id}/enrollment") public Person enroll(@PathVariable Long id,@RequestBody Enroll body,@AuthenticationPrincipal User u){return service.enroll(id,body,u);}
    @PutMapping("/people/{id}/course") public Person course(@PathVariable Long id,@RequestBody Course body,@AuthenticationPrincipal User u){return service.saveCourse(id,body,u);}
    @PutMapping("/people/{id}/decision") public Person decision(@PathVariable Long id,@RequestBody Decision body,@AuthenticationPrincipal User u){return service.decide(id,body,u);}
    @PostMapping("/people/{id}/assignment-request") public Person request(@PathVariable Long id,@RequestBody Revision body,@AuthenticationPrincipal User u){return service.requestAssignment(id,body,u);}
    @PutMapping("/people/{id}/assignment") public Person assign(@PathVariable Long id,@RequestBody Assign body,@AuthenticationPrincipal User u){return service.assign(id,body,u);}
    @GetMapping("/classes") public List<ClassChoice> classes(@AuthenticationPrincipal User u){return service.classChoices(u);}
    @GetMapping("/weeks/{date}") public Week week(@PathVariable LocalDate date,@AuthenticationPrincipal User u){return service.week(date,u);}
    @PutMapping("/weeks/{date}/attendance") public Week attendance(@PathVariable LocalDate date,@RequestBody AttendanceInput body,@AuthenticationPrincipal User u){return service.saveChecks(date,body,u);}
    @PutMapping("/weeks/{date}/references") public Week link(@PathVariable LocalDate date,@RequestBody LinkInput body,@AuthenticationPrincipal User u){return service.link(date,body,u);}
    @PostMapping("/weeks/{date}/submission") public Week submit(@PathVariable LocalDate date,@RequestBody Submit body,@AuthenticationPrincipal User u){return service.submit(date,body,u);}
}
