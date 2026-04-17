package com.newaveflow.service;

import com.newaveflow.dto.classes.ClassDto;
import com.newaveflow.dto.classes.StudentDto;
import com.newaveflow.repository.ClassGroupRepository;
import com.newaveflow.repository.StudentRepository;
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

    public List<ClassDto> getClassesForTeacher(Long teacherId) {
        // 관리자/임원/목회자는 전체 권한인지만, 현재 프론트 MSW 설계는 단순 TEACHER 클래스 배열이라
        // teacherId로 해당 교사가 담당하는 반 목록을 가져오도록 기본 구현합니다. (추후 권한 확장 가능)
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
