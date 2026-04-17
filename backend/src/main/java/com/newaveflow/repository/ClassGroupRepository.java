package com.newaveflow.repository;

import com.newaveflow.entity.ClassGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ClassGroupRepository extends JpaRepository<ClassGroup, Long> {

    @Query("""
        SELECT DISTINCT tc.classGroup FROM TeacherClass tc
        WHERE tc.teacher.id = :teacherId
        ORDER BY tc.classGroup.name
        """)
    List<ClassGroup> findByTeacherId(@Param("teacherId") Long teacherId);
}
