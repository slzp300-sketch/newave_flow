package com.newaveflow.controller;

import com.newaveflow.dto.auth.LoginResponse.UserInfo;
import com.newaveflow.entity.TeacherClass;
import com.newaveflow.entity.User;
import com.newaveflow.repository.TeacherClassRepository;
import com.newaveflow.repository.UserRepository;
import com.newaveflow.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final AuthService authService;

    /** User.grade가 없으면 TeacherClass → ClassGroup.ageGroup 에서 학년 추출 */
    private String resolveGrade(User u) {
        String g = u.getGrade();
        if (g != null && !g.isBlank()) return g;
        // 배정된 반의 ageGroup 에서 학년 가져오기
        List<TeacherClass> tcs = teacherClassRepository.findByTeacherId(u.getId());
        if (tcs == null || tcs.isEmpty()) return "미분류";
        String ageGroup = tcs.get(0).getClassGroup().getAgeGroup();
        return (ageGroup != null && !ageGroup.isBlank()) ? ageGroup : "미분류";
    }

    private String extractGradeFromDesc(String desc) {
        if (desc == null || desc.isBlank()) return "미분류";
        String clean = desc.replaceAll("\\s+", "");
        if (clean.startsWith("유치")) return "유치";
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("([초중고][1-6])").matcher(clean);
        if (m.find()) return m.group(1);
        return "미분류";
    }

    @GetMapping("/me")
    public ResponseEntity<UserInfo> getMe(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(new UserInfo(
            currentUser.getId(), currentUser.getName(),
            currentUser.getEmail(), currentUser.getRole().name(),
            currentUser.getGrade(), currentUser.isActive()
        ));
    }

    @GetMapping("/teachers")
    @Transactional(readOnly = true)
    public ResponseEntity<List<UserInfo>> getTeachers() {
        List<UserInfo> teachers = userRepository.findByRoleAndIsActiveTrue(User.Role.TEACHER)
            .stream()
            .map(u -> new UserInfo(u.getId(), u.getName(), u.getEmail(), u.getRole().name(), resolveGrade(u), u.isActive()))
            .toList();
        return ResponseEntity.ok(teachers);
    }

    @GetMapping("")
    @Transactional(readOnly = true)
    public ResponseEntity<List<UserInfo>> getAllUsers() {
        List<UserInfo> users = userRepository.findByIsActiveTrue()
            .stream()
            .map(u -> new UserInfo(u.getId(), u.getName(), u.getEmail(), u.getRole().name(), resolveGrade(u), u.isActive()))
            .toList();
        return ResponseEntity.ok(users);
    }

    @PutMapping("/me/password")
    @Transactional
    public ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal User currentUser,
            @RequestBody PasswordChangeRequest request) {
        if (currentUser == null) return ResponseEntity.status(401).build();
        authService.changePassword(currentUser.getId(), request.currentPassword(), request.newPassword());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{id}/role")
    @Transactional
    public ResponseEntity<Void> updateRole(@PathVariable Long id, @RequestBody RoleRequest request) {
        User user = userRepository.findById(id).orElseThrow(() -> new RuntimeException("User not found"));
        User.Role newRole = User.Role.valueOf(request.role());

        if (newRole == User.Role.PASTOR || newRole == User.Role.ADMIN) {
            long count = userRepository.findByIsActiveTrue().stream()
                .filter(u -> u.getRole() == User.Role.PASTOR || u.getRole() == User.Role.ADMIN)
                .count();

            boolean isAlreadyPastorOrAdmin = user.getRole() == User.Role.PASTOR || user.getRole() == User.Role.ADMIN;

            if (!isAlreadyPastorOrAdmin && count >= 2) {
                throw com.newaveflow.exception.AppException.badRequest("최종관리자 및 목사님 권한은 최대 2명까지만 설정할 수 있습니다.");
            }
        }

        user.updateRole(newRole);
        userRepository.save(user);
        return ResponseEntity.ok().build();
    }

    public record RoleRequest(String role) {}
    public record PasswordChangeRequest(String currentPassword, String newPassword) {}
}
