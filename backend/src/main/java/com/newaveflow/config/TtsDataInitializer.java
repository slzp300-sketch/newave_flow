package com.newaveflow.config;

import com.newaveflow.entity.TtsQuestion;
import com.newaveflow.entity.TtsQuestion.TtsQuestionType;
import com.newaveflow.repository.TtsQuestionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class TtsDataInitializer implements CommandLineRunner {

    private final TtsQuestionRepository questionRepository;

    @Override
    public void run(String... args) {
        if (questionRepository.count() == 0) {
            List<TtsQuestion> initialQuestions = List.of(
                TtsQuestion.builder().title("기도 (30분 이상)").type(TtsQuestionType.DAYS).emoji("🙏").displayOrder(1).isActive(true).build(),
                TtsQuestion.builder().title("말씀 (3장 이상)").type(TtsQuestionType.DAYS).emoji("📖").displayOrder(2).isActive(true).build(),
                TtsQuestion.builder().title("교사 회의").type(TtsQuestionType.ATTEND).emoji("👥").displayOrder(3).isActive(true).build(),
                TtsQuestion.builder().title("온라인 줌 기도모임").type(TtsQuestionType.ATTEND).emoji("💻").displayOrder(4).isActive(true).build(),
                TtsQuestion.builder().title("본 예배").type(TtsQuestionType.ATTEND).emoji("⛪").displayOrder(5).isActive(true).build(),
                TtsQuestion.builder().title("금요 철야").type(TtsQuestionType.ATTEND).emoji("🕯️").displayOrder(6).isActive(true).build()
            );
            questionRepository.saveAll(initialQuestions);
        }
    }
}
