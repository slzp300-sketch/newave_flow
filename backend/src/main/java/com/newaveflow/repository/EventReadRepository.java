package com.newaveflow.repository;

import com.newaveflow.entity.EventRead;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface EventReadRepository extends JpaRepository<EventRead, Long> {
    List<EventRead> findByUserId(Long userId);
    Optional<EventRead> findByUserIdAndEventId(Long userId, Long eventId);
}
