package com.newaveflow.repository;

import com.newaveflow.entity.PrayerVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PrayerVoteRepository extends JpaRepository<PrayerVote, Long> {

    Optional<PrayerVote> findByTeacherIdAndWeekStart(Long teacherId, LocalDate weekStart);

    @Query("""
        SELECT v FROM PrayerVote v
        JOIN FETCH v.teacher t
        WHERE v.weekStart = :weekStart AND v.status = 'ABSENT'
        ORDER BY t.name
        """)
    List<PrayerVote> findAbsentByWeekStart(@Param("weekStart") LocalDate weekStart);
}
