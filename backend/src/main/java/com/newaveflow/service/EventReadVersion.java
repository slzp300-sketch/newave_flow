package com.newaveflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.entity.Event;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;

/** Hash the displayed content, not attendance records or internal roster timestamps. */
public final class EventReadVersion {
    private static final ObjectMapper JSON = new ObjectMapper();
    private EventReadVersion() {}
    private static String date(Object value) { return value == null ? null : value.toString(); }

    public static String of(Event event) {
        try {
            var fields = new java.util.ArrayList<Object>(Arrays.asList(event.getTitle(), event.getDescription(),
                    date(event.getEventDate()), date(event.getEndDate()), event.getStartTime(), event.getEndTime(),
                    event.getEventType().name(), event.getColor(), event.isAttendanceRequired(),
                    date(event.getAttendanceDeadline()), event.getAttendanceTarget() == null
                            ? Event.AttendanceTarget.STUDENT_ONLY.name() : event.getAttendanceTarget().name()));
            // Preserve V002 versions for unchanged legacy events with no start date.
            if (event.getAttendanceStartDate() != null) fields.add(event.getAttendanceStartDate().toString());
            String content = JSON.writeValueAsString(fields);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Unable to calculate event content version", e);
        }
    }
}
