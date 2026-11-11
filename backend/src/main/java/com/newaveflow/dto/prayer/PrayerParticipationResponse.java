package com.newaveflow.dto.prayer;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record PrayerParticipationResponse(
        LocalDate weekStart, Summary summary, List<Person> people, List<Summary> trend) {
    public record Person(Long teacherId, String teacherName, String teacherGrade,
                         String status, String reason, LocalDateTime updatedAt) {}
    public record Summary(LocalDate weekStart, int tuesday, int thursday, int absent, int unanswered) {
        public int responded() { return tuesday + thursday + absent; }
    }
}
