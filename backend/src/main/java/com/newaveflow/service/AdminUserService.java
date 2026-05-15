package com.newaveflow.service;

import com.newaveflow.dto.UserApprovalRequest;
import com.newaveflow.dto.auth.LoginResponse.UserInfo;
import com.newaveflow.entity.ClassGroup;
import com.newaveflow.entity.TeacherClass;
import com.newaveflow.entity.User;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.ClassGroupRepository;
import com.newaveflow.repository.TeacherClassRepository;
import com.newaveflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminUserService {
    
    private final UserRepository userRepository;
    private final ClassGroupRepository classGroupRepository;
    private final TeacherClassRepository teacherClassRepository;

    public List<UserInfo> getPendingUsers() {
        return userRepository.findByIsActiveFalse().stream()
                .map(u -> UserInfo.from(u, u.getGrade()))
                .toList();
    }

    @Transactional
    public void approveUser(Long userId, UserApprovalRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> AppException.notFound("사용자를 찾을 수 없습니다."));

        user.approve();

        if (request != null && request.getClassGroupId() != null) {
            ClassGroup classGroup = classGroupRepository.findById(request.getClassGroupId())
                    .orElseThrow(() -> AppException.notFound("반을 찾을 수 없습니다."));
            
            TeacherClass teacherClass = TeacherClass.builder()
                    .teacher(user)
                    .classGroup(classGroup)
                    .isPrimary(true)
                    .build();
            teacherClassRepository.save(teacherClass);
        }
    }
}
