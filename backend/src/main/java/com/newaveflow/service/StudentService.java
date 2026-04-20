package com.newaveflow.service;

import com.newaveflow.dto.classes.StudentDto;
import com.newaveflow.dto.classes.StudentUpdateRequest;
import com.newaveflow.entity.DeactivationRequest;
import com.newaveflow.entity.Student;
import com.newaveflow.entity.StudentMemo;
import com.newaveflow.entity.TeacherClass;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.DeactivationRequestRepository;
import com.newaveflow.repository.StudentMemoRepository;
import com.newaveflow.repository.StudentRepository;
import com.newaveflow.repository.TeacherClassRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StudentService {

    private final StudentRepository studentRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final DeactivationRequestRepository deactivationRequestRepository;
    private final StudentMemoRepository studentMemoRepository;

    public StudentDto getStudentById(Long id) {
        Student student = studentRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("학생을 찾을 수 없습니다."));
        return StudentDto.from(student);
    }

    // 교사: 내 반 학생 전체 조회 (제적 포함)
    public List<StudentDto> getMyClassStudents(Long teacherId) {
        List<TeacherClass> teacherClasses = teacherClassRepository.findByTeacherId(teacherId);
        if (teacherClasses.isEmpty()) return List.of();

        TeacherClass primary = teacherClasses.stream()
                .filter(TeacherClass::isPrimary)
                .findFirst()
                .orElse(teacherClasses.get(0));

        List<Student> students = studentRepository
                .findByClassGroupIdOrderByIsActiveDescNameAsc(primary.getClassGroup().getId());

        List<Long> studentIds = students.stream().map(Student::getId).toList();

        Set<Long> pendingIds = deactivationRequestRepository
                .findByStudentIdIn(studentIds).stream()
                .filter(r -> r.getStatus() == DeactivationRequest.Status.PENDING)
                .map(r -> r.getStudent().getId())
                .collect(Collectors.toSet());

        Map<Long, StudentMemo> memoMap = studentMemoRepository.findByTeacherId(teacherId).stream()
                .collect(Collectors.toMap(m -> m.getStudent().getId(), m -> m));

        return students.stream()
                .map(s -> {
                    StudentMemo memo = memoMap.get(s.getId());
                    return StudentDto.from(
                        s, 
                        pendingIds.contains(s.getId()), 
                        memo != null ? memo.getPrayerRequest() : null,
                        memo != null ? memo.getSketch() : null
                    );
                })
                .toList();
    }

    // 학생 정보 수정
    @Transactional
    public StudentDto updateStudent(Long id, StudentUpdateRequest request) {
        Student student = studentRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("학생을 찾을 수 없습니다."));

        LocalDate birthDate = null;
        if (request.birthDate() != null && !request.birthDate().isBlank()) {
            birthDate = LocalDate.parse(request.birthDate());
        }

        student.update(
                request.name(), request.gender(), birthDate,
                request.school(), request.phone(), request.baptism(),
                request.fatherName(), request.fatherPhone(),
                request.motherName(), request.motherPhone(),
                request.address()
        );
        return StudentDto.from(studentRepository.save(student));
    }

    // 제적 처리
    @Transactional
    public StudentDto deactivateStudent(Long id) {
        Student student = studentRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("학생을 찾을 수 없습니다."));
        student.deactivate();
        return StudentDto.from(studentRepository.save(student));
    }

    // 복적 처리
    @Transactional
    public StudentDto activateStudent(Long id) {
        Student student = studentRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("학생을 찾을 수 없습니다."));
        student.activate();
        return StudentDto.from(studentRepository.save(student));
    }
}
