package com.newaveflow.task;
import com.newaveflow.repository.PushDeliveryRepository;
import com.newaveflow.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Instant;

@Component @RequiredArgsConstructor
public class PushDeliveryTask {
    private final PushDeliveryRepository deliveries;
    private final PushDeliveryService service;
    private final PushTransport transport;
    @Value("${PUSH_ENABLED:false}") private boolean enabled;
    @Value("${NOTIFICATIONS_ENABLED:false}") private boolean notificationsEnabled;
    @Scheduled(fixedDelay=30000)
    public void dispatch() {
        if(!enabled || !notificationsEnabled || !transport.available()) return;
        Instant now=Instant.now();
        for(var item:deliveries.findTop100ByStatusAndNextAttemptAtLessThanEqualOrderById("PENDING",now)) {
            try { service.deliver(item.getId(),now); } catch(Exception ignored) { /* Durable row stays retryable; never expose provider secrets. */ }
        }
    }
}
