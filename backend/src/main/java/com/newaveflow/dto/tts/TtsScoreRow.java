package com.newaveflow.dto.tts;

/** Only the values needed for scoring; no account, profile or answer entity graph. */
public record TtsScoreRow(Long recordId, Long teacherId, Integer weekNum, Long questionId, String answerData) {}
