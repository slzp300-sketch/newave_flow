package com.newaveflow.controller;

import com.newaveflow.dto.auth.LoginResponse.UserInfo;
import com.newaveflow.entity.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @GetMapping("/me")
    public ResponseEntity<UserInfo> getMe(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(new UserInfo(
                currentUser.getId(),
                currentUser.getName(),
                currentUser.getEmail(),
                currentUser.getRole().name()
        ));
    }
}
