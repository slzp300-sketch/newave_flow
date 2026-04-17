package com.newaveflow.repository;

import com.newaveflow.entity.MeetingAttendance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface MeetingAttendanceRepository extends JpaRepository<MeetingAttendance, Long> {
    Optional<MeetingAttendance> findByTeacherIdAndMeetingDate(Long teacherId, LocalDate meetingDate);
}
