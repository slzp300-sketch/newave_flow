package com.newaveflow.dto.tts;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Read-only, selected-week detail. Never serializes user entities or contact data. */
public record TtsWeekStatsResponse(int year, int weekNum, LocalDate weekStart, Integer maxScore,
                                   boolean importedPeriod, List<Person> people) {
    public record Person(String key, Long teacherId, String name, String grade, Integer score,
                         String source, LocalDateTime updatedAt, List<Item> items) {}
    public record Item(Long questionId, String title, String type, int points, boolean linked,
                       boolean active, List<String> days, boolean checked, int score, List<String> eligibleDays) {}
}
