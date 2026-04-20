package com.newaveflow.service;

import com.newaveflow.entity.Student;
import com.newaveflow.entity.StudentMemo;
import com.newaveflow.entity.User;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.StudentMemoRepository;
import com.newaveflow.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class StudentMemoService {

    private final StudentMemoRepository studentMemoRepository;
    private final StudentRepository studentRepository;

    @Transactional
    public void saveMemo(Long studentId, String prayerRequest, String sketch, User teacher) {
        studentMemoRepository.findByStudentIdAndTeacherId(studentId, teacher.getId())
                .ifPresentOrElse(
                        memo -> memo.update(prayerRequest, sketch),
                        () -> {
                            Student student = studentRepository.findById(studentId)
                                     .orElseThrow(() -> AppException.notFound("학생을 찾을 수 없습니다."));
                            studentMemoRepository.save(StudentMemo.builder()
                                    .student(student)
                                    .teacher(teacher)
                                    .prayerRequest(prayerRequest)
                                    .sketch(sketch)
                                    .build());
                        }
                );
    }
}
