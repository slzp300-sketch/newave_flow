package com.newaveflow.service;

import com.newaveflow.entity.Event;
import com.newaveflow.exception.AppException;
import java.time.LocalDate;
import java.util.Set;

public final class InputRules {
    private InputRules() {}
    public static void eventDates(String title, LocalDate start, LocalDate end) {
        if (title == null || title.isBlank() || start == null) throw AppException.badRequest("일정 제목과 시작일을 입력해주세요.");
        if (end != null && end.isBefore(start)) throw AppException.badRequest("종료일이 시작일보다 빠를 수 없습니다.");
    }
    public static void eventAttendance(Event event, String status, String reason, LocalDate partialDate) {
        if (status == null || !Set.of("PRESENT", "PARTIAL", "ABSENT").contains(status)) throw AppException.badRequest("출석 상태가 올바르지 않습니다.");
        if ("ABSENT".equals(status) && (reason == null || reason.isBlank())) throw AppException.badRequest("불참 사유를 입력해주세요.");
        LocalDate end = event.getEndDate() == null ? event.getEventDate() : event.getEndDate();
        if ("PARTIAL".equals(status) && (partialDate == null || partialDate.isBefore(event.getEventDate()) || partialDate.isAfter(end))) {
            throw AppException.badRequest("부분 참석 시작일은 행사 기간 안에서 선택해주세요.");
        }
    }
}
