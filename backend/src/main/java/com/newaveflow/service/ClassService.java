package com.newaveflow.service;

import com.newaveflow.dto.classes.ClassDto;
import com.newaveflow.dto.classes.StudentDto;
import com.newaveflow.entity.ClassGroup;
import com.newaveflow.entity.TeacherClass;
import com.newaveflow.repository.ClassGroupRepository;
import com.newaveflow.repository.StudentRepository;
import com.newaveflow.repository.TeacherClassRepository;
import com.newaveflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ClassService {

    private final ClassGroupRepository classGroupRepository;
    private final StudentRepository studentRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final UserRepository userRepository;

    public List<ClassDto> getAllRosterData() {
        List<com.newaveflow.entity.ClassGroup> classes = classGroupRepository.findAll();
        List<TeacherClass> allTeacherClasses = teacherClassRepository.findAll();
        
        return classes.stream().map(cls -> {
            String teacherName = allTeacherClasses.stream()
                    .filter(tc -> tc.getClassGroup().getId().equals(cls.getId()) && tc.isPrimary())
                    .map(tc -> tc.getTeacher().getName())
                    .findFirst()
                    .orElse(null);
            
            List<StudentDto> students = studentRepository.findByClassGroupIdAndIsActiveTrue(cls.getId())
                    .stream()
                    .map(StudentDto::from)
                    .toList();
            
            return ClassDto.from(cls, teacherName, students);
        }).toList();
    }

    public List<ClassDto> getClassesForTeacher(Long teacherId) {
        com.newaveflow.entity.User user = userRepository.findById(teacherId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        // 관리자/임원/목회자는 전체 권한
        if (user.getRole() == com.newaveflow.entity.User.Role.ADMIN || 
            user.getRole() == com.newaveflow.entity.User.Role.PASTOR || 
            user.getRole() == com.newaveflow.entity.User.Role.EXECUTIVE) {
            return classGroupRepository.findAll()
                    .stream()
                    .map(ClassDto::from)
                    .toList();
        }

        return classGroupRepository.findByTeacherId(teacherId)
                .stream()
                .map(ClassDto::from)
                .toList();
    }

    public List<StudentDto> getStudentsInClass(Long classGroupId) {
        return studentRepository.findByClassGroupIdAndIsActiveTrue(classGroupId)
                .stream()
                .map(StudentDto::from)
                .toList();
    }
}
