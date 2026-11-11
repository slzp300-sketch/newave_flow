package com.newaveflow.dto.tts;
import java.time.LocalDate;
import java.util.Map;
// Partial field intent prevents one device from overwriting another day's check.
public record TtsFieldAnswerRequest(LocalDate weekStart, Long questionId, Map<String, Boolean> changes, Boolean checked) {}
