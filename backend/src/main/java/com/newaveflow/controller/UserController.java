package com.newaveflow.controller;

import com.newaveflow.dto.auth.LoginResponse.UserInfo;
import com.newaveflow.entity.User;
import com.newaveflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}
