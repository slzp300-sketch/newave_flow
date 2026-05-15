package com.newaveflow.controller;

import com.newaveflow.dto.auth.LoginResponse.UserInfo;
import com.newaveflow.dto.auth.TeacherRosterItem;
import com.newaveflow.entity.ClassGroup;
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

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final AuthService authService;

    private String resolveGrade(User u) {
        String g = u.getGrade();
        if (g != null && !g.isBlank()) return g;
        List<TeacherClass> tcs = teacherClassRepository.findByTeacherId(u.getId());
        if (tcs == null || tcs.isEmpty()) return "미분류";
        String ageGroup = tcs.get(0).getClassGroup().getAgeGroup();
        return (ageGroup != null && !ageGroup.isBlank()) ? ageGroup : "미분류";
    }

    @GetMapping("/me")
    public ResponseEntity<UserInfo> getMe(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return ResponseEntity.status(401).build();
        User fullUser = userRepository.findById(currentUser.getId())
            .orElseThrow(() -> com.newaveflow.exception.AppException.notFound("사용자를 찾을 수 없습니다."));
        return ResponseEntity.ok(UserInfo.from(fullUser, resolveGrade(fullUser)));
    }

    /** 내 프로필 정보 (profileImage 포함) */
    @GetMapping("/me/profile")
    public ResponseEntity<Map<String, Object>> getMyProfile(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return ResponseEntity.status(401).build();
        User u = userRepository.findById(currentUser.getId())
            .orElseThrow(() -> com.newaveflow.exception.AppException.notFound("사용자를 찾을 수 없습니다."));
        Map<String, Object> result = new HashMap<>();
        result.put("profileImage", u.getProfileImage());
        result.put("birthDate", u.getBirthDate() != null ? u.getBirthDate().toString() : null);
        result.put("phone", u.getPhone());
        result.put("name", u.getName());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/teachers")
    @Transactional(readOnly = true)
    public ResponseEntity<List<UserInfo>> getTeachers() {
        List<UserInfo> teachers = userRepository.findByIsActiveTrue().stream()
            .filter(u -> u.getRole() == User.Role.TEACHER || u.getRole() == User.Role.EXECUTIVE)
            .map(u -> UserInfo.from(u, resolveGrade(u)))
            .toList();
        return ResponseEntity.ok(teachers);
    }

    /** 교사 교적부: 목사님/임원/교사 전원 + 반 배정 + 프로필 이미지 */
    @GetMapping("/teachers/roster")
    @Transactional(readOnly = true)
    public ResponseEntity<List<TeacherRosterItem>> getTeacherRoster() {
        // teacherId → "학년 반명" 매핑
        Map<Long, String> classMap = new HashMap<>();
        teacherClassRepository.findAll().forEach(tc -> {
            ClassGroup cg = tc.getClassGroup();
            if (cg != null) {
                String label = (cg.getAgeGroup() != null ? cg.getAgeGroup() + " " : "") + cg.getName();
                classMap.put(tc.getTeacher().getId(), label);
            }
        });

        List<TeacherRosterItem> result = userRepository.findByIsActiveTrue().stream()
            .filter(u -> u.getRole() != User.Role.ADMIN)
            .map(u -> new TeacherRosterItem(
                u.getId(), u.getName(), u.getRole().name(), u.getPhone(),
                u.getBirthDate() != null ? u.getBirthDate().toString() : null,
                u.getProfileImage(),
                classMap.get(u.getId())
            ))
            .toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("")
    @Transactional(readOnly = true)
    public ResponseEntity<List<UserInfo>> getAllUsers() {
        List<UserInfo> users = userRepository.findByIsActiveTrue()
            .stream()
            .filter(u -> u.getRole() != User.Role.ADMIN)
            .map(u -> UserInfo.from(u, resolveGrade(u)))
            .toList();
        return ResponseEntity.ok(users);
    }

    @PutMapping("/me/profile")
    @Transactional
    public ResponseEntity<Void> updateProfile(
            @AuthenticationPrincipal User currentUser,
            @RequestBody ProfileRequest request) {
        if (currentUser == null) return ResponseEntity.status(401).build();
        User user = userRepository.findById(currentUser.getId())
            .orElseThrow(() -> com.newaveflow.exception.AppException.notFound("사용자를 찾을 수 없습니다."));
        LocalDate birthDate = null;
        if (request.birthDate() != null && !request.birthDate().isBlank()) {
            birthDate = LocalDate.parse(request.birthDate());
        }
        user.updateProfile(request.name(), request.phone(), birthDate, request.profileImage());
        userRepository.save(user);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/me/settings")
    @Transactional
    public ResponseEntity<Void> updateSettings(
            @AuthenticationPrincipal User currentUser,
            @RequestBody SettingsRequest request) {
        if (currentUser == null) return ResponseEntity.status(401).build();
        User user = userRepository.findById(currentUser.getId())
            .orElseThrow(() -> com.newaveflow.exception.AppException.notFound("사용자를 찾을 수 없습니다."));
        user.updateLargeFont(request.largeFont());
        userRepository.save(user);
        return ResponseEntity.ok().build();
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
    public record SettingsRequest(boolean largeFont) {}
    public record ProfileRequest(String name, String phone, String birthDate, String profileImage) {}
}
