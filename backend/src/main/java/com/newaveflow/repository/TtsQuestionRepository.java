package com.newaveflow.repository;

import com.newaveflow.entity.TtsQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface TtsQuestionRepository extends JpaRepository<TtsQuestion, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT q FROM TtsQuestion q ORDER BY q.id")
    java.util.List<TtsQuestion> lockAll();
    List<TtsQuestion> findAllByIsActiveOrderByDisplayOrderAsc(boolean isActive);
    List<TtsQuestion> findAllByOrderByDisplayOrderAsc();

    @Query("SELECT COUNT(a) > 0 FROM TtsAnswer a WHERE a.question.id = :questionId")
    boolean hasAnswers(@Param("questionId") Long questionId);
}
