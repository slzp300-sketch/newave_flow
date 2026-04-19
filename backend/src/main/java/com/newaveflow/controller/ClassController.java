package com.newaveflow.controller;

import com.newaveflow.dto.classes.ClassDto;
import com.newaveflow.dto.classes.StudentDto;
import com.newaveflow.entity.User;
import com.newaveflow.service.ClassService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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
        // 임시: 현재 사용자의 아이디로 매핑된 반만 가져옵니다. 
        // 권한이 PASTOR나 EXECUTIVE이면 전체 반을 가져오도록 Service 안에서 분기할 수도 있습니다.
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
}
