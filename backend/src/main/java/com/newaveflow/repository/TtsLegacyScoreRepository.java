package com.newaveflow.repository;

import com.newaveflow.entity.TtsLegacyScore;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TtsLegacyScoreRepository extends JpaRepository<TtsLegacyScore, Long> {
    List<TtsLegacyScore> findAllByInfoYear(Integer infoYear);

    @Modifying
    @Query("DELETE FROM TtsLegacyScore s WHERE s.infoYear = :year")
    void deleteAllByYear(@Param("year") Integer year);
}
