package com.newaveflow.repository;

import com.newaveflow.entity.PrayerVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PrayerVoteRepository extends JpaRepository<PrayerVote, Long> {

    @Query("SELECT v FROM PrayerVote v JOIN FETCH v.teacher t LEFT JOIN FETCH t.teacherClasses tc LEFT JOIN FETCH tc.classGroup WHERE v.id = :id")
    Optional<PrayerVote> findByIdWithTeacher(@Param("id") Long id);

    @Query("SELECT v FROM PrayerVote v JOIN FETCH v.teacher t LEFT JOIN FETCH t.teacherClasses tc LEFT JOIN FETCH tc.classGroup WHERE t.id = :teacherId AND v.weekStart = :weekStart")
    Optional<PrayerVote> findByTeacherIdAndWeekStart(@Param("teacherId") Long teacherId, @Param("weekStart") LocalDate weekStart);

    @Query("""
        SELECT v FROM PrayerVote v
        JOIN FETCH v.teacher t
        LEFT JOIN FETCH t.teacherClasses tc
        LEFT JOIN FETCH tc.classGroup
        WHERE v.weekStart = :weekStart AND v.status = 'ABSENT'
        ORDER BY t.name
        """)
    List<PrayerVote> findAbsentByWeekStart(@Param("weekStart") LocalDate weekStart);
}
