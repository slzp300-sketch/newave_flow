package com.newaveflow.service;

import com.newaveflow.dto.event.EventDto.MeetingAttendanceRequest;
import com.newaveflow.dto.event.EventDto.MeetingAttendanceResponse;
import com.newaveflow.entity.MeetingAttendance;
import com.newaveflow.entity.User;
import com.newaveflow.repository.MeetingAttendanceRepository;
import com.newaveflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MeetingService {

    private final MeetingAttendanceRepository meetingAttendanceRepository;
    private final UserRepository userRepository;

    public MeetingAttendanceResponse getMeetingAttendance(Long teacherId, LocalDate meetingDate) {
        return meetingAttendanceRepository.findByTeacherIdAndMeetingDate(teacherId, meetingDate)
                .map(MeetingAttendanceResponse::from)
                .orElse(new MeetingAttendanceResponse(teacherId, meetingDate, null, null));
    }

    @Transactional
    public MeetingAttendanceResponse saveMeetingAttendance(Long teacherId, MeetingAttendanceRequest request) {
        MeetingAttendance existing = meetingAttendanceRepository.findByTeacherIdAndMeetingDate(teacherId, request.meetingDate())
                .orElse(null);

        if (existing != null) {
            existing.updateStatus(request.status(), request.reason());
            return MeetingAttendanceResponse.from(existing);
        } else {
            User teacher = userRepository.findById(teacherId)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));

            MeetingAttendance newAttendance = MeetingAttendance.builder()
                    .teacher(teacher)
                    .meetingDate(request.meetingDate())
                    .status(request.status())
                    .reason(request.reason())
                    .build();
            meetingAttendanceRepository.save(newAttendance);
            return MeetingAttendanceResponse.from(newAttendance);
        }
    }

    public java.util.List<MeetingAttendanceResponse> getAdminMeetingAttendance(LocalDate meetingDate) {
        return meetingAttendanceRepository.findByMeetingDate(meetingDate).stream()
                .map(MeetingAttendanceResponse::from)
                .toList();
    }
}
