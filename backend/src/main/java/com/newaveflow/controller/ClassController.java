package com.newaveflow.controller;

import com.newaveflow.dto.classes.ClassDto;
import com.newaveflow.dto.classes.StudentDto;
import com.newaveflow.entity.User;
import com.newaveflow.service.ClassService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/classes")
@RequiredArgsConstructor
public class ClassController {

    private final ClassService classService;

    @GetMapping
    public ResponseEntity<List<ClassDto>> getClasses(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(classService.getClassesForTeacher(currentUser.getId()));
    }

    @GetMapping("/roster")
    public ResponseEntity<List<ClassDto>> getRoster() {
        return ResponseEntity.ok(classService.getAllRosterData());
    }

    @GetMapping("/{id}/students")
    public ResponseEntity<List<StudentDto>> getStudents(@PathVariable Long id) {
        return ResponseEntity.ok(classService.getStudentsInClass(id));
    }

    @PostMapping("/{classId}/assign-teacher/{userId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PASTOR', 'EXECUTIVE')")
    public ResponseEntity<Void> assignTeacher(
            @PathVariable Long classId,
            @PathVariable Long userId,
            @RequestParam boolean isPrimary) {
        classService.assignTeacher(classId, userId, isPrimary);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{classId}/remove-teacher/{userId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PASTOR', 'EXECUTIVE')")
    public ResponseEntity<Void> removeTeacher(
            @PathVariable Long classId,
            @PathVariable Long userId) {
        classService.removeTeacher(classId, userId);
        return ResponseEntity.ok().build();
    }
}
