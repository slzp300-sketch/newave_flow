package com.newaveflow.service;

import com.newaveflow.exception.AppException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

/** TTS는 일~토 주간 총점을 분기 단위로 평가한다. 기존 원본 기록은 삭제하지 않는다. */
public final class TtsPeriod {
    public static final int START_YEAR = 2026;
    public static final int START_WEEK = 40;
    public static final int LAST_SHEET_WEEK = 41;
    public static final ZoneId ZONE = ZoneId.of("Asia/Seoul");

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

    public static LocalDate today() { return LocalDate.now(ZONE); }

    public static int quarter(LocalDate date) { return (date.getMonthValue() - 1) / 3 + 1; }

    public static LocalDate quarterStart(LocalDate date) {
        return LocalDate.of(date.getYear(), (quarter(date) - 1) * 3 + 1, 1);
    }

    public static LocalDate quarterStart(int year, int quarter) {
        validateQuarter(year, quarter);
        return LocalDate.of(year, (quarter - 1) * 3 + 1, 1);
    }

    public static LocalDate quarterEnd(int year, int quarter) {
        return quarterStart(year, quarter).plusMonths(3).minusDays(1);
    }

    /** Daily values belong to their actual date; undated weekly values belong to Saturday. */
    public static LocalDate attendanceDate(LocalDate sunday) { return sunday.plusDays(6); }

    public static boolean closed(LocalDate date, LocalDate today) { return date.isBefore(quarterStart(today)); }

    public static boolean editableDay(LocalDate date, LocalDate today) {
        return !closed(date, today) && !date.isAfter(today);
    }

    public static boolean editableAttendance(LocalDate sunday, LocalDate today) {
        var date = attendanceDate(sunday);
        // A weekly check may be made before Saturday, but not in a different quarter.
        return !sunday.isAfter(today) && !closed(date, today)
                && date.isBefore(quarterStart(today).plusMonths(3));
    }

    public static void validateQuarter(int year, int quarter) {
        firstSunday(year);
        if (quarter < 1 || quarter > 4) throw AppException.badRequest("분기가 올바르지 않습니다.");
    }
}
