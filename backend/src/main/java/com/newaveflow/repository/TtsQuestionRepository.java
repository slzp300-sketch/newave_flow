package com.newaveflow.repository;

import com.newaveflow.entity.TtsQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface TtsQuestionRepository extends JpaRepository<TtsQuestion, Long> {
    List<TtsQuestion> findAllByIsActiveOrderByDisplayOrderAsc(boolean isActive);
    List<TtsQuestion> findAllByOrderByDisplayOrderAsc();

    @Query("SELECT COUNT(a) > 0 FROM TtsAnswer a WHERE a.question.id = :questionId")
    boolean hasAnswers(@Param("questionId") Long questionId);
}
