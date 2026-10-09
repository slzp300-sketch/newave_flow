package com.newaveflow.dto.tts;

import java.time.LocalDate;

// 항목 하나를 탭할 때마다 바로 저장하는 요청
public record TtsAnswerRequest(LocalDate weekStart, Long questionId, String answerData) {}
