package com.newaveflow.service;

import com.newaveflow.entity.Event;
import com.newaveflow.exception.AppException;
import java.time.LocalDate;
import java.time.ZoneId;

/** Date-based reception window, inclusive through the deadline in Korea. */
public final class EventAttendanceWindow {
    private EventAttendanceWindow() {}
    public static LocalDate today() { return LocalDate.now(ZoneId.of("Asia/Seoul")); }
    public static LocalDate deadline(Event event) {
        return event.getAttendanceDeadline() != null ? event.getAttendanceDeadline()
                : event.getEndDate() != null ? event.getEndDate() : event.getEventDate();
    }
    public static void assertOpen(Event event, LocalDate today) {
        if (!event.isAttendanceRequired()) throw AppException.badRequest("출석 체크가 비활성화된 일정입니다.");
        if (today.isAfter(deadline(event))) throw AppException.badRequest("출석 접수가 종료되었습니다. 기존 기록만 확인할 수 있습니다.");
        if (event.getAttendanceStartDate() != null && today.isBefore(event.getAttendanceStartDate()))
            throw AppException.badRequest("아직 출석 접수 기간이 아닙니다.");
    }
    public static LocalDate start(LocalDate requested, LocalDate deadline) {
        // Older clients omit the start date. Preserve their immediate-open behavior.
        return requested != null ? requested : today().isAfter(deadline) ? deadline : today();
    }
    public static void validate(LocalDate start, LocalDate deadline) {
        if (start.isAfter(deadline)) throw AppException.badRequest("출석 접수 마감일은 시작일보다 빠를 수 없습니다.");
    }
}
