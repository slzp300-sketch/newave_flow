package com.newaveflow.repository;

import com.newaveflow.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface StudentRepository extends JpaRepository<Student, Long> {
    List<Student> findByClassGroupIdAndIsActiveTrue(Long classGroupId);
    List<Student> findByClassGroupIdOrderByIsActiveDescNameAsc(Long classGroupId);
    List<Student> findAllByIsActiveTrueOrderByGradeAscNameAsc();
    List<Student> findAllByOrderByGradeAscIsActiveDescNameAsc();

    @Query("SELECT s FROM Student s JOIN FETCH s.classGroup ORDER BY s.grade ASC, s.isActive DESC, s.name ASC")
    List<Student> findAllWithClassGroup();

    @Query("SELECT s FROM Student s JOIN FETCH s.classGroup WHERE s.isActive = true ORDER BY s.grade ASC, s.name ASC")
    List<Student> findAllActiveWithClassGroup();
}
