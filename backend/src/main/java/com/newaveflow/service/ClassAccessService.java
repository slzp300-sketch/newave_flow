package com.newaveflow.service;

import com.newaveflow.entity.Student;
import com.newaveflow.entity.User;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.TeacherClassRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ClassAccessService {
    private final TeacherClassRepository assignments;

    public void requireClass(User user, Long classId) {
        if (user == null || !user.isActive()) throw AppException.unauthorized("로그인이 필요합니다.");
        if (user.getRole() != User.Role.TEACHER) return;
        if (classId == null || assignments.findByClassGroup_IdAndTeacher_Id(classId, user.getId()).isEmpty()) {
            throw AppException.forbidden("담당 반만 수정할 수 있습니다.");
        }
    }

    public void requireStudent(User user, Student student) {
        requireClass(user, student.getClassGroup() == null ? null : student.getClassGroup().getId());
    }
}
