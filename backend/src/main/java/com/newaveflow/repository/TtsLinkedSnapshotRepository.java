package com.newaveflow.repository;

import com.newaveflow.entity.TtsLinkedSnapshot;
import com.newaveflow.entity.TtsQuestion.TtsLinkType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface TtsLinkedSnapshotRepository extends JpaRepository<TtsLinkedSnapshot, Long> {
    boolean existsByTeacherIdAndWeekStartAndLinkType(Long teacherId, LocalDate weekStart, TtsLinkType linkType);
    List<TtsLinkedSnapshot> findByWeekStartBetween(LocalDate from, LocalDate to);
}
