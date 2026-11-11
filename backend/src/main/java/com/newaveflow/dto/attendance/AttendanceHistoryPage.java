package com.newaveflow.dto.attendance;

import java.time.LocalDate;
import java.util.List;

public record AttendanceHistoryPage(List<AttendanceResponse> items, boolean hasMore, LocalDate nextBefore) {}
