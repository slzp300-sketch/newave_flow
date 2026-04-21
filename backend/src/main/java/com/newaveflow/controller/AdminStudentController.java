package com.newaveflow.controller;

import com.newaveflow.dto.classes.AdminStudentDto;
import com.newaveflow.dto.classes.StudentCreateRequest;
import com.newaveflow.service.StudentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/students")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'PASTOR', 'EXECUTIVE')")
public class AdminStudentController {

    private final StudentService studentService;

    // 전체 학생 조회 (학년별 그룹핑)
    @GetMapping
    public ResponseEntity<Map<String, List<AdminStudentDto>>> getAllStudents() {
        return ResponseEntity.ok(studentService.getAllStudentsGroupedByGrade());
    }

    // 학생 신규 등록
    @PostMapping
    public ResponseEntity<AdminStudentDto> createStudent(@RequestBody StudentCreateRequest request) {
        return ResponseEntity.ok(studentService.createStudent(request));
    }

    // 학생 정보 수정
    @PutMapping("/{id}")
    public ResponseEntity<AdminStudentDto> updateStudent(
            @PathVariable Long id,
            @RequestBody StudentCreateRequest request) {
        return ResponseEntity.ok(studentService.updateStudentAdmin(id, request));
    }

    // 학생 반 배정 변경
    @PatchMapping("/{id}/class")
    public ResponseEntity<AdminStudentDto> assignClass(
            @PathVariable Long id,
            @RequestBody Map<String, Long> body) {
        Long classGroupId = body.get("classGroupId");
        return ResponseEntity.ok(studentService.assignStudentToClass(id, classGroupId));
    }

    // 제적 처리
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<Void> deactivate(@PathVariable Long id) {
        studentService.deactivateStudent(id);
        return ResponseEntity.ok().build();
    }

    // 복적 처리
    @PatchMapping("/{id}/activate")
    public ResponseEntity<Void> activate(@PathVariable Long id) {
        studentService.activateStudent(id);
        return ResponseEntity.ok().build();
    }

    // 학년 일괄 진급 (연도 개편)
    // body: { "중1": "중2", "중2": "중3", ... }
    @PostMapping("/bulk-advance")
    public ResponseEntity<Map<String, Integer>> bulkAdvance(@RequestBody Map<String, String> gradeMap) {
        int count = studentService.bulkAdvanceGrades(gradeMap);
        return ResponseEntity.ok(Map.of("advanced", count));
    }
}
