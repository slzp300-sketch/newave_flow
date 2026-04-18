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
        if (from == null) from = LocalDate.now().minusMonths(6);
        if (to == null) to = LocalDate.now().plusMonths(6);
        
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
    public EventResponse createEvent(com.newaveflow.dto.event.EventDto.EventCreateRequest request) {
        Event event = Event.builder()
                .title(request.title())
                .description(request.description())
                .eventDate(request.eventDate())
                .startTime(request.startTime())
                .endTime(request.endTime())
                .color(request.color())
                .eventType(Event.EventType.valueOf(request.eventType()))
                .build();
        return EventResponse.from(eventRepository.save(event));
    }

    @Transactional
    public EventResponse updateEvent(Long id, com.newaveflow.dto.event.EventDto.EventCreateRequest request) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Event not found"));
        
        event.setTitle(request.title());
        event.setDescription(request.description());
        event.setEventDate(request.eventDate());
        event.setStartTime(request.startTime());
        event.setEndTime(request.endTime());
        event.setColor(request.color());
        event.setEventType(Event.EventType.valueOf(request.eventType()));
        
        return EventResponse.from(eventRepository.save(event));
    }

    @Transactional
    public void deleteEvent(Long id) {
        eventAttendanceRepository.deleteAllByEventId(id);
        eventRepository.deleteById(id);
    }
}
