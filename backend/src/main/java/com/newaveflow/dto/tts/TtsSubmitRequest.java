package com.newaveflow.dto.tts;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TtsSubmitRequest {
    private Integer year;
    private Integer weekNum;
    private List<AnswerRequest> answers;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AnswerRequest {
        private Long questionId;
        private String answerData;
    }
}
