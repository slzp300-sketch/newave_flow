package com.newaveflow.controller;

import com.newaveflow.dto.auth.LoginResponse.UserInfo;
import com.newaveflow.entity.User;
import com.newaveflow.repository.UserRepository;
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

    @GetMapping("/me")
    public ResponseEntity<UserInfo> getMe(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(new UserInfo(
            currentUser.getId(), currentUser.getName(),
            currentUser.getEmail(), currentUser.getRole().name(),
            currentUser.getGrade()
        ));
    }

    @GetMapping("/teachers")
    public ResponseEntity<List<UserInfo>> getTeachers() {
        List<UserInfo> teachers = userRepository.findByRoleAndIsActiveTrue(User.Role.TEACHER)
            .stream()
            .map(u -> new UserInfo(u.getId(), u.getName(), u.getEmail(), u.getRole().name(), u.getGrade()))
            .toList();
        return ResponseEntity.ok(teachers);
    }

    @GetMapping("")
    public ResponseEntity<List<UserInfo>> getAllUsers() {
        List<UserInfo> users = userRepository.findByIsActiveTrue()
            .stream()
            .map(u -> new UserInfo(u.getId(), u.getName(), u.getEmail(), u.getRole().name(), u.getGrade()))
            .toList();
        return ResponseEntity.ok(users);
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
}
