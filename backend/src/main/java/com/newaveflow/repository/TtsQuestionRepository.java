package com.newaveflow.repository;

import com.newaveflow.entity.TtsQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TtsQuestionRepository extends JpaRepository<TtsQuestion, Long> {
    List<TtsQuestion> findAllByIsActiveOrderByDisplayOrderAsc(boolean isActive);
}
