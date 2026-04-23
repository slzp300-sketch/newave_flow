package com.newaveflow.service;

import com.newaveflow.dto.classes.ClassDto;
import com.newaveflow.dto.classes.ClassTeacherDto;
import com.newaveflow.dto.classes.StudentDto;
import com.newaveflow.entity.ClassGroup;
import com.newaveflow.entity.TeacherClass;
import com.newaveflow.entity.User;
import com.newaveflow.repository.ClassGroupRepository;
import com.newaveflow.repository.StudentRepository;
import com.newaveflow.repository.TeacherClassRepository;
import com.newaveflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ClassService {

    private final ClassGroupRepository classGroupRepository;
    private final StudentRepository studentRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final UserRepository userRepository;

    public List<ClassDto> getAllRosterData() {
        List<ClassGroup> classes = classGroupRepository.findAll();
        // JOIN FETCH로 teacher, classGroup을 즉시 로딩 (LazyInitializationException 방지)
        List<TeacherClass> allTeacherClasses = teacherClassRepository.findAllWithTeacherAndClass();
        
        return classes.stream().map(cls -> {
            List<ClassTeacherDto> teachers = allTeacherClasses.stream()
                    .filter(tc -> tc.getClassGroup().getId().equals(cls.getId()))
                    .map(tc -> new ClassTeacherDto(tc.getTeacher().getId(), tc.getTeacher().getName(), tc.isPrimary()))
                    .toList();

            String primaryTeacherName = teachers.stream()
                    .filter(ClassTeacherDto::isPrimary)
                    .map(ClassTeacherDto::name)
                    .findFirst()
                    .orElse(null);
            
            List<StudentDto> students = studentRepository.findByClassGroupIdAndIsActiveTrue(cls.getId())
                    .stream()
                    .map(StudentDto::from)
                    .toList();
            
            return ClassDto.from(cls, primaryTeacherName, teachers, students);
        }).toList();
    }

    public List<ClassDto> getClassesForTeacher(Long teacherId) {
        User user = userRepository.findById(teacherId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        if (user.getRole() == User.Role.ADMIN || 
            user.getRole() == User.Role.PASTOR || 
            user.getRole() == User.Role.EXECUTIVE) {
            return getAllRosterData();
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

    @Transactional
    public void assignTeacher(Long classId, Long userId, boolean isPrimary) {
        ClassGroup classGroup = classGroupRepository.findById(classId)
                .orElseThrow(() -> new RuntimeException("반을 찾을 수 없습니다."));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("교사를 찾을 수 없습니다."));

        if (isPrimary) {
            // 기존 담임이 있으면 부담임으로 강등
            teacherClassRepository.findByClassGroup_IdAndIsPrimaryTrue(classId)
                .ifPresent(tc -> {
                    if (!tc.getTeacher().getId().equals(userId)) {
                        tc.setPrimary(false);
                        teacherClassRepository.save(tc);
                    }
                });
        }

        Optional<TeacherClass> existing = teacherClassRepository.findByClassGroup_IdAndTeacher_Id(classId, userId);
        
        if (existing.isPresent()) {
            // 기존 배정에 있으면 역할만 업데이트
            TeacherClass tc = existing.get();
            tc.setPrimary(isPrimary);
            teacherClassRepository.save(tc);
        } else {
            // 신규 배정
            TeacherClass newTc = TeacherClass.builder()
                    .teacher(user)
                    .classGroup(classGroup)
                    .isPrimary(isPrimary)
                    .build();
            teacherClassRepository.save(newTc);
        }
    }

    @Transactional
    public void removeTeacher(Long classId, Long userId) {
        teacherClassRepository.deleteByClassGroup_IdAndTeacher_Id(classId, userId);
    }

    @Transactional
    public void updateTeachers(Long classId, com.newaveflow.dto.classes.TeacherAssignmentRequest request) {
        ClassGroup classGroup = classGroupRepository.findById(classId)
                .orElseThrow(() -> new RuntimeException("반을 찾을 수 없습니다."));

        // 기존 배정 모두 삭제
        teacherClassRepository.deleteByClassGroup_Id(classId);

        // 새로운 배정 추가
        for (var assignment : request.assignments()) {
            User user = userRepository.findById(assignment.userId())
                    .orElseThrow(() -> new RuntimeException("교사를 찾을 수 없습니다. ID: " + assignment.userId()));

            TeacherClass tc = TeacherClass.builder()
                    .teacher(user)
                    .classGroup(classGroup)
                    .isPrimary(assignment.isPrimary())
                    .build();
            teacherClassRepository.save(tc);
        }
    }
}
