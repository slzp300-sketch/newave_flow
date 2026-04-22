package com.newaveflow.repository;

import com.newaveflow.entity.TeacherClass;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface TeacherClassRepository extends JpaRepository<TeacherClass, Long> {
    // Legacy mapping (no underscore) for existing services
    List<TeacherClass> findByTeacherId(Long teacherId);
    List<TeacherClass> findByClassGroupId(Long classGroupId);

    // New assignment logic mapping
    Optional<TeacherClass> findByClassGroup_IdAndIsPrimaryTrue(Long classGroupId);
    Optional<TeacherClass> findByClassGroup_IdAndTeacher_Id(Long classGroupId, Long teacherId);

    // Eager fetch for roster (avoids LazyInitializationException)
    @Query("SELECT tc FROM TeacherClass tc JOIN FETCH tc.teacher JOIN FETCH tc.classGroup")
    List<TeacherClass> findAllWithTeacherAndClass();

    @Modifying
    @Transactional
    void deleteByClassGroup_IdAndTeacher_Id(Long classGroupId, Long teacherId);
}
