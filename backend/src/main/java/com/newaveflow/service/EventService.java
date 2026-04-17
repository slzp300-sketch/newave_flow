package com.newaveflow.service;

import com.newaveflow.dto.event.EventDto.EventAttendanceRequest;
import com.newaveflow.dto.event.EventDto.EventResponse;
import com.newaveflow.entity.Event;
import com.newaveflow.entity.EventAttendance;
import com.newaveflow.entity.User;
import com.newaveflow.repository.EventAttendanceRepository;
import com.newaveflow.repository.EventRepository;
import com.newaveflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EventService {

    private final EventRepository eventRepository;
    private final EventAttendanceRepository eventAttendanceRepository;
    private final UserRepository userRepository;

    public List<EventResponse> getEvents(LocalDate from, LocalDate to) {
        return eventRepository.findByDateRange(from, to)
                .stream()
                .map(EventResponse::from)
                .toList();
    }

    public EventResponse getEvent(Long id) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Event not found"));
        return EventResponse.from(event);
    }

    @Transactional
    public void saveEventAttendance(Long eventId, Long teacherId, EventAttendanceRequest request) {
        EventAttendance existing = eventAttendanceRepository.findByEventIdAndTeacherId(eventId, teacherId)
                .orElse(null);

        if (existing != null) {
            existing.updateStatus(request.status());
        } else {
            Event event = eventRepository.findById(eventId)
                    .orElseThrow(() -> new IllegalArgumentException("Event not found"));
            User teacher = userRepository.findById(teacherId)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));
            
            EventAttendance newAttendance = EventAttendance.builder()
                    .event(event)
                    .teacher(teacher)
                    .status(request.status())
                    .build();
            eventAttendanceRepository.save(newAttendance);
        }
    }
}
