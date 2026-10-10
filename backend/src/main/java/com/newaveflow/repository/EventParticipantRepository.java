package com.newaveflow.repository;

import com.newaveflow.entity.EventParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface EventParticipantRepository extends JpaRepository<EventParticipant, Long> {
    List<EventParticipant> findByEventIdAndKindOrderByName(Long eventId, String kind);
    Optional<EventParticipant> findByEventIdAndKindAndPersonId(Long eventId, String kind, Long personId);
    void deleteByEventId(Long eventId);
}
