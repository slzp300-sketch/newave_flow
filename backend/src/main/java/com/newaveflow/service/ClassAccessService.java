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
        if (user.getRole() == User.Role.ADMIN || user.getRole() == User.Role.PASTOR || user.getRole() == User.Role.EXECUTIVE) return;
        if (user.getRole() != User.Role.TEACHER || user.getId() == null || classId == null
                || assignments.findByClassGroup_IdAndTeacher_Id(classId, user.getId()).isEmpty()) {
            throw AppException.forbidden("담당 반만 접근할 수 있습니다.");
        }
    }

    public void requireStudent(User user, Student student) {
        if(user!=null&&user.getRole()==User.Role.TEACHER&&!student.belongsToClassOn(java.time.LocalDate.now()))
            throw AppException.forbidden("반 배정 적용일부터 확인할 수 있습니다.");
        requireClass(user, student.getClassGroup() == null ? null : student.getClassGroup().getId());
    }
}
