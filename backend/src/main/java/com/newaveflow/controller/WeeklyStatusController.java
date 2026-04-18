package com.newaveflow.controller;

import com.newaveflow.entity.DailyReport;
import com.newaveflow.entity.User;
import com.newaveflow.repository.DailyReportRepository;
import com.newaveflow.repository.MeetingMinuteConfirmRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/weekly-status")
@RequiredArgsConstructor
public class WeeklyStatusController {

    private final DailyReportRepository dailyReportRepository;
    private final MeetingMinuteConfirmRepository meetingMinuteConfirmRepository;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getWeeklyStatus(@AuthenticationPrincipal User currentUser) {
        LocalDate today = LocalDate.now();
        // 일요일 시작 주간 (일~토)
        LocalDate sunday = today.minusDays(today.getDayOfWeek().getValue() % 7);
        LocalDate saturday = sunday.plusDays(6);

        List<DailyReport> weeklyReports = dailyReportRepository
                .findByTeacherIdAndReportDateBetween(currentUser.getId(), sunday, saturday);

        boolean attendanceSubmitted = weeklyReports.stream()
                .anyMatch(r -> r.getStatus() == DailyReport.Status.SUBMITTED);

        long unconfirmedMinutesCount = meetingMinuteConfirmRepository.countUnconfirmedForUser(currentUser);

        return ResponseEntity.ok(Map.of(
                "attendanceSubmittedThisWeek", attendanceSubmitted,
                "unconfirmedMinutesCount", unconfirmedMinutesCount
        ));
    }
}
