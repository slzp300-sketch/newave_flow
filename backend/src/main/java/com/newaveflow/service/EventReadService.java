package com.newaveflow.service;

import com.newaveflow.entity.EventRead;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.LinkedHashMap;
import java.util.Map;

@Service @RequiredArgsConstructor
public class EventReadService {
    private final EventRepository events;
    private final EventReadRepository reads;
    private final UserRepository users;

    @Transactional(readOnly = true)
    public Map<Long, String> getReads(Long userId) {
        Map<Long, String> result = new LinkedHashMap<>();
        reads.findByUserId(userId).forEach(read -> result.put(read.getEvent().getId(), read.getContentVersion()));
        return result;
    }

    @Transactional
    public Map<Long, String> acknowledge(Long userId, Long eventId, String version) {
        // Serialize simultaneous first acknowledgements and reject stale devices after an edit.
        var event = events.lockById(eventId).orElseThrow(() -> AppException.notFound("일정을 찾을 수 없습니다."));
        if (!EventReadVersion.of(event).equals(version))
            throw AppException.conflict("일정이 변경되었습니다. 최신 내용을 다시 확인해 주세요.");
        var previous = reads.findByUserIdAndEventId(userId, eventId);
        if (previous.isEmpty()) reads.save(new EventRead(users.getReferenceById(userId), event, version));
        else if (!previous.get().getContentVersion().equals(version)) previous.get().acknowledge(version);
        return Map.of(eventId, version);
    }
}
