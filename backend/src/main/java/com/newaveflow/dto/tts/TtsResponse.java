package com.newaveflow.dto.tts;

import com.newaveflow.entity.TtsQuestion.TtsQuestionType;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class TtsResponse {
    private Long id;
    private Integer year;
    private Integer weekNum;
    private LocalDate weekStart;   // 해당 주의 일요일
    private boolean isSubmitted;
    private List<AnswerResponse> answers;
    private List<LinkedResponse> linked;
    private int score;

    @Data
    @Builder
    public static class AnswerResponse {
        private Long questionId;
        private String title;
        private TtsQuestionType type;
        private String emoji;
        private String answerData;
    }

    // 다른 화면 기록에서 자동으로 체크되는 항목
    @Data
    @Builder
    public static class LinkedResponse {
        private Long questionId;
        private boolean checked;
    }
}
