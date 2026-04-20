package com.newaveflow.dto.tts;

import com.newaveflow.entity.TtsQuestion.TtsQuestionType;
import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class TtsResponse {
    private Long id;
    private Integer year;
    private Integer weekNum;
    private boolean isSubmitted;
    private List<AnswerResponse> answers;
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
}
