package com.newaveflow.repository;

import com.newaveflow.entity.TeacherClass;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TeacherClassRepository extends JpaRepository<TeacherClass, Long> {
    List<TeacherClass> findByTeacherId(Long teacherId);
}
