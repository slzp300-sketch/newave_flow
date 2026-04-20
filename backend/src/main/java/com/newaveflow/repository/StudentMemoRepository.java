package com.newaveflow.repository;

import com.newaveflow.entity.StudentMemo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StudentMemoRepository extends JpaRepository<StudentMemo, Long> {
    List<StudentMemo> findByTeacherId(Long teacherId);
    Optional<StudentMemo> findByStudentIdAndTeacherId(Long studentId, Long teacherId);
}
