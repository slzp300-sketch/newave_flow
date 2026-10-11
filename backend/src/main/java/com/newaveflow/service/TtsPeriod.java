package com.newaveflow.service;

import com.newaveflow.exception.AppException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/** TTS는 일~토 주간 총점을 분기 단위로 평가한다. 기존 원본 기록은 삭제하지 않는다. */
public final class TtsPeriod {
    public static final int START_YEAR = 2026;
    public static final int START_WEEK = 40;
    public static final int LAST_SHEET_WEEK = 41;

    private TtsPeriod() {}

    public static LocalDate firstSunday(int year) {
        if (year < 1900 || year > 9998) throw AppException.badRequest("연도가 올바르지 않습니다.");
        return TtsService.weekSunday(LocalDate.of(year, 1, 1));
    }

    public static int weeksInYear(int year) {
        return (int) (ChronoUnit.DAYS.between(firstSunday(year),
                TtsService.weekSunday(LocalDate.of(year + 1, 1, 1))) / 7);
    }

    public static LocalDate sunday(int year, int week) {
        if (week < 1 || week > weeksInYear(year)) throw AppException.badRequest("해당 연도에 없는 주차입니다.");
        return firstSunday(year).plusWeeks(week - 1L);
    }

    public static int firstManagedWeek(int year) { return year == START_YEAR ? START_WEEK : 1; }

    public static boolean includes(int year, int week) {
        return year >= START_YEAR && week >= firstManagedWeek(year) && week <= weeksInYear(year);
    }

    public static boolean usesSheet(int year, int week) {
        return year == START_YEAR && week >= START_WEEK && week <= LAST_SHEET_WEEK;
    }

    public static int quarter(int week) { return Math.min((week - 1) / 13 + 1, 4); }

    public static void validateQuarter(int year, int quarter) {
        firstSunday(year);
        if (quarter < 1 || quarter > 4) throw AppException.badRequest("분기가 올바르지 않습니다.");
    }
}
