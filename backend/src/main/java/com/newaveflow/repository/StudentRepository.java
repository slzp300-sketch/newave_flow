package com.newaveflow.repository;

import com.newaveflow.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StudentRepository extends JpaRepository<Student, Long> {
    List<Student> findByClassGroupIdAndIsActiveTrue(Long classGroupId);
    List<Student> findByClassGroupIdOrderByIsActiveDescNameAsc(Long classGroupId);
    List<Student> findAllByIsActiveTrueOrderByGradeAscNameAsc();
    List<Student> findAllByOrderByGradeAscIsActiveDescNameAsc();
}
