package com.newaveflow.repository;

import com.newaveflow.entity.TtsRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.List;

public interface TtsRecordRepository extends JpaRepository<TtsRecord, Long> {
    Optional<TtsRecord> findByTeacherIdAndInfoYearAndWeekNum(Long teacherId, Integer infoYear, Integer weekNum);
    List<TtsRecord> findAllByInfoYearAndWeekNum(Integer infoYear, Integer weekNum);

    @Query("SELECT DISTINCT r FROM TtsRecord r LEFT JOIN FETCH r.answers a LEFT JOIN FETCH a.question WHERE r.infoYear = :year AND r.weekNum = :weekNum")
    List<TtsRecord> findAllByWeekWithAnswers(@Param("year") Integer year, @Param("weekNum") Integer weekNum);

    @Query("SELECT DISTINCT r FROM TtsRecord r LEFT JOIN FETCH r.answers a LEFT JOIN FETCH a.question WHERE r.infoYear = :year AND r.isSubmitted = true")
    List<TtsRecord> findAllSubmittedByYearWithAnswers(@Param("year") Integer year);
}
