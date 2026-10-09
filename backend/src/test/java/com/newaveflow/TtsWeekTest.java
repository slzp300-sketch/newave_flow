package com.newaveflow;

import com.newaveflow.service.TtsService;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

// 구글 시트 주차 표기("1주차(2025-12-28~2026-01-03)")와 서버 주차 계산이 같은지 확인
class TtsWeekTest {

    @Test
    void firstWeekStartsOnSundayBeforeNewYear() {
        LocalDate sunday = TtsService.weekSunday(LocalDate.of(2026, 1, 3));
        assertEquals(LocalDate.of(2025, 12, 28), sunday);
        assertEquals(2026, TtsService.weekYear(sunday));
        assertEquals(1, TtsService.weekNum(sunday));
    }

    @Test
    void laterWeeks() {
        LocalDate sunday = TtsService.weekSunday(LocalDate.of(2026, 10, 9)); // 금요일
        assertEquals(LocalDate.of(2026, 10, 4), sunday);
        assertEquals(2026, TtsService.weekYear(sunday));
        assertEquals(41, TtsService.weekNum(sunday));
    }
}
