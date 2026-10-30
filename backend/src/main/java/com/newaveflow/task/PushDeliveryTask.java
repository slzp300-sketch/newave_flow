package com.newaveflow.task;
import com.newaveflow.repository.PushDeliveryRepository;
import com.newaveflow.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.stream.Stream;
import org.springframework.data.domain.PageRequest;

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
        var platforms=Stream.of("IOS","ANDROID").filter(transport::available).toList();
        // Exclude disabled platforms before limiting the batch; their expired rows still get cleaned up.
        for(var id:deliveries.findDueIds(now,platforms,PageRequest.of(0,100))) {
            try { service.deliver(id,now); } catch(Exception ignored) { /* Durable row stays retryable; never expose provider secrets. */ }
        }
    }
}
