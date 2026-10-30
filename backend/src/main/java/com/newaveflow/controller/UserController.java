package com.newaveflow.controller;

import com.newaveflow.dto.auth.LoginResponse.UserInfo;
import com.newaveflow.dto.auth.TeacherRosterItem;
import com.newaveflow.entity.ClassGroup;
import com.newaveflow.entity.TeacherClass;
import com.newaveflow.entity.User;
import com.newaveflow.repository.TeacherClassRepository;
import com.newaveflow.repository.UserRepository;
import com.newaveflow.repository.UserTagRepository;
import com.newaveflow.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final UserTagRepository userTagRepository;
    private final AuthService authService;
    private final com.newaveflow.service.PhotoModerationService photos;
    private final com.newaveflow.service.AdminUserService adminUsers;

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
        result.put("gender", u.getGender());
        result.put("churchPosition", u.getChurchPosition());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/teachers")
    @Transactional(readOnly = true)
    public ResponseEntity<List<UserInfo>> getTeachers() {
        List<UserInfo> teachers = userRepository.findByIsActiveTrue().stream()
            .filter(User::participatesInTeacherActivities)
            .map(u -> UserInfo.from(u, resolveGrade(u)))
            .toList();
        return ResponseEntity.ok(teachers);
    }

    /** 교사 교적부: 관리자/목사님/임원/교사 전원 + 반 배정 + 프로필 이미지 + 태그 */
    @GetMapping("/teachers/roster")
    @Transactional(readOnly = true)
    public ResponseEntity<List<TeacherRosterItem>> getTeacherRoster() {
        // teacherId → "학년 반명" 매핑
        Map<Long, String> classMap = new HashMap<>();
        teacherClassRepository.findAllWithTeacherAndClass().forEach(tc -> {
            ClassGroup cg = tc.getClassGroup();
            if (cg != null) {
                String label = (cg.getAgeGroup() != null ? cg.getAgeGroup() + " " : "") + cg.getName();
                classMap.put(tc.getTeacher().getId(), label);
            }
        });

        // teacherId → 태그 목록 매핑
        Map<Long, List<TeacherRosterItem.TagInfo>> tagsMap = new HashMap<>();
        userTagRepository.findAllWithTag().forEach(ut ->
            tagsMap.computeIfAbsent(ut.getUser().getId(), k -> new ArrayList<>())
                .add(new TeacherRosterItem.TagInfo(ut.getTag().getId(), ut.getTag().getName(), ut.getTag().getCategory(), ut.getTag().getColor()))
        );

        List<TeacherRosterItem> result = userRepository.findByIsActiveTrue().stream()
            .map(u -> new TeacherRosterItem(
                u.getId(), u.getName(), u.getRole().name(), u.getPhone(),
                u.getBirthDate() != null ? u.getBirthDate().toString() : null,
                u.getProfileImage(),
                classMap.get(u.getId()),
                tagsMap.getOrDefault(u.getId(), List.of()),
                u.getChurchPosition(), u.getGender()
            ))
            .toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("")
    @Transactional(readOnly = true)
    public ResponseEntity<List<UserInfo>> getAllUsers() {
        List<UserInfo> users = userRepository.findByIsActiveTrue()
            .stream()
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
        User user = userRepository.lockById(currentUser.getId())
            .orElseThrow(() -> com.newaveflow.exception.AppException.notFound("사용자를 찾을 수 없습니다."));
        LocalDate birthDate = null;
        if (request.birthDate() != null && !request.birthDate().isBlank()) {
            birthDate = LocalDate.parse(request.birthDate());
        }
        com.newaveflow.service.ContentTextFilter.check(request.name(),request.churchPosition());
        String approvedImage=photos.submit(com.newaveflow.entity.ModeratedPhoto.TargetType.USER,user.getId(),
            user.getProfileImage(),request.profileImage(),currentUser.getId());
        user.updateProfile(request.name(), request.phone(), birthDate, approvedImage, request.churchPosition());
        // Older clients omit this field; keep the saved value in that case.
        if (request.gender() != null) {
            String gender = request.gender().trim();
            if (!Set.of("", "남", "여").contains(gender)) throw com.newaveflow.exception.AppException.badRequest("성별을 확인해주세요.");
            user.updateGender(gender.isEmpty() ? null : gender);
        }
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

    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'PASTOR', 'EXECUTIVE')")
    @PutMapping("/{id}/role")
    @Transactional
    public ResponseEntity<Void> updateRole(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody RoleRequest request) {
        User.Role role;
        try { role=User.Role.valueOf(request.role()); }
        catch (IllegalArgumentException|NullPointerException e) {
            throw com.newaveflow.exception.AppException.badRequest("권한을 확인해주세요.");
        }
        adminUsers.updateRole(currentUser,id,role);
        return ResponseEntity.ok().build();
    }

    public record RoleRequest(String role) {}
    public record PasswordChangeRequest(String currentPassword, String newPassword) {}
    public record SettingsRequest(boolean largeFont) {}
    public record ProfileRequest(String name, String phone, String birthDate, String profileImage, String churchPosition, String gender) {}
}
