package com.newaveflow.service;

import com.newaveflow.dto.classes.StudentDto;
import com.newaveflow.entity.Student;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StudentService {

    private final StudentRepository studentRepository;

    public StudentDto getStudentById(Long id) {
        Student student = studentRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("학생을 찾을 수 없습니다."));
        return StudentDto.from(student);
    }
}
