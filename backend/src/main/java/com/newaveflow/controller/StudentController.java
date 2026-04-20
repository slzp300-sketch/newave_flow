package com.newaveflow.controller;

import com.newaveflow.dto.classes.StudentDto;
import com.newaveflow.dto.classes.StudentUpdateRequest;
import com.newaveflow.entity.User;
import com.newaveflow.service.StudentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/students")
@RequiredArgsConstructor
public class StudentController {

    private final StudentService studentService;

    @GetMapping("/{id}")
    public ResponseEntity<StudentDto> getStudent(@PathVariable Long id) {
        return ResponseEntity.ok(studentService.getStudentById(id));
    }

    // 교사: 내 반 학생 전체 조회 (제적 포함)
    @GetMapping("/my-class")
    public ResponseEntity<List<StudentDto>> getMyClassStudents(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(studentService.getMyClassStudents(currentUser.getId()));
    }

    // 학생 정보 수정
    @PutMapping("/{id}")
    public ResponseEntity<StudentDto> updateStudent(
            @PathVariable Long id,
            @Valid @RequestBody StudentUpdateRequest request) {
        return ResponseEntity.ok(studentService.updateStudent(id, request));
    }

    // 제적 처리
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<StudentDto> deactivateStudent(@PathVariable Long id) {
        return ResponseEntity.ok(studentService.deactivateStudent(id));
    }

    // 복적 처리
    @PatchMapping("/{id}/activate")
    public ResponseEntity<StudentDto> activateStudent(@PathVariable Long id) {
        return ResponseEntity.ok(studentService.activateStudent(id));
    }
}
