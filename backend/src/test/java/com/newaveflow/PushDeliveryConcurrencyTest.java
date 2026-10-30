package com.newaveflow;

import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import com.newaveflow.task.PushDeliveryTask;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DataJpaTest(showSql=false,properties={"NOTIFICATIONS_ENABLED=true","PUSH_ENABLED=true"}) @ActiveProfiles("test")
@Import({PushDeliveryService.class,PushDeliveryTask.class})
class PushDeliveryConcurrencyTest {
    @Autowired UserRepository users;
    @Autowired NotificationRepository notifications;
    @Autowired NotificationPreferenceRepository preferences;
    @Autowired PushDeviceRepository devices;
    @Autowired PushDeliveryRepository deliveries;
    @Autowired PushDeliveryService worker;
    @Autowired PushDeliveryTask task;
    @Autowired PlatformTransactionManager transactionManager;
    @MockBean PushTransport transport;
    @MockBean NotificationEligibilityService eligibility;

    @BeforeEach void providersAreFake() {
        when(transport.available()).thenReturn(true);
        when(transport.available(anyString())).thenReturn(true);
        when(transport.send(any(),any())).thenReturn(PushTransport.Result.SENT);
        when(eligibility.relevant(any(),any(),any())).thenReturn(true);
    }
    User account() {
        var user=users.saveAndFlush(User.builder().name("Synthetic delivery")
                .email("delivery@example.invalid").password("synthetic").role(User.Role.TEACHER).build());
        preferences.saveAndFlush(new NotificationPreference(user.getId(),true));
        return user;
    }
    PushDelivery queued(User user,String platform,int ordinal,Instant expiry) {
        var device=new PushDevice();
        device.setInstallationId(UUID.randomUUID().toString());device.setUserId(user.getId());device.setPlatform(platform);
        device.setToken("synthetic-token-"+ordinal);device.setTokenHash(String.format("%064x",ordinal));
        device.setActive(true);device.setUpdatedAt(Instant.EPOCH);devices.saveAndFlush(device);
        var notice=notifications.saveAndFlush(Notification.builder().user(user).title("Synthetic")
                .content("Synthetic body").type(Notification.NotificationType.SYSTEM).dedupeKey("fixture:"+ordinal).build());
        var delivery=new PushDelivery();delivery.setNotificationId(notice.getId());delivery.setInstallationId(device.getInstallationId());
        delivery.setNextAttemptAt(Instant.EPOCH);delivery.setExpiresAt(expiry);
        return deliveries.saveAndFlush(delivery);
    }

    @Test @Transactional(propagation=Propagation.NOT_SUPPORTED)
    @DirtiesContext(methodMode=DirtiesContext.MethodMode.AFTER_METHOD)
    void twoWorkersThatCachedPendingBeforeLockingStillSendOnlyOnce() throws Exception {
        var tx=new TransactionTemplate(transactionManager);
        Instant now=Instant.parse("2026-10-20T00:00:00Z");
        Long id=tx.execute(s->queued(account(),"IOS",1,now.plusSeconds(3600)).getId());
        var bothRead=new CountDownLatch(2);var proceed=new CountDownLatch(1);
        var executor=Executors.newFixedThreadPool(2);
        Callable<Void> delivery=()->tx.execute(s->{
            assertEquals("PENDING",deliveries.findById(id).orElseThrow().getStatus());
            bothRead.countDown();
            try { assertTrue(proceed.await(10,TimeUnit.SECONDS)); }
            catch(InterruptedException e) { Thread.currentThread().interrupt();throw new IllegalStateException(e); }
            worker.deliver(id,now);return null;
        });
        try {
            var first=executor.submit(delivery);var second=executor.submit(delivery);
            assertTrue(bothRead.await(10,TimeUnit.SECONDS));proceed.countDown();
            first.get(15,TimeUnit.SECONDS);second.get(15,TimeUnit.SECONDS);
        } finally {proceed.countDown();executor.shutdownNow();}
        verify(transport,times(1)).send(any(),any());
        tx.execute(s->{var result=deliveries.findById(id).orElseThrow();
            assertEquals("SENT",result.getStatus());assertEquals(1,result.getAttempts());return null;});
    }

    @Test void disabledPlatformBacklogCannotHideEnabledDeliveryOrExpiredRows() {
        var user=account();var later=Instant.now().plusSeconds(86400);
        for(int i=1;i<=200;i++) queued(user,"IOS",i,later);
        var expired=queued(user,"IOS",201,Instant.EPOCH);
        var android=queued(user,"ANDROID",202,later);
        when(transport.available("IOS")).thenReturn(false);
        task.dispatch();
        assertEquals("SENT",deliveries.findById(android.getId()).orElseThrow().getStatus());
        assertEquals("CANCELED",deliveries.findById(expired.getId()).orElseThrow().getStatus());
        assertEquals(200,deliveries.findAll().stream().filter(d->"PENDING".equals(d.getStatus())).count());
        verify(transport,times(1)).send(argThat(d->"ANDROID".equals(d.getPlatform())),any());
        verify(transport,never()).send(argThat(d->"IOS".equals(d.getPlatform())),any());
    }

    @Test void platformDisabledDuringSendDefersWithoutAttemptAndNeverBeyondExpiry() {
        var user=account();var now=Instant.parse("2026-10-20T00:00:00Z");
        var delivery=queued(user,"IOS",1,now.plusSeconds(60));
        when(transport.send(any(),any())).thenReturn(PushTransport.Result.DISABLED);
        worker.deliver(delivery.getId(),now);
        assertEquals("PENDING",delivery.getStatus());assertEquals(0,delivery.getAttempts());
        assertEquals(delivery.getExpiresAt(),delivery.getNextAttemptAt());
        worker.deliver(delivery.getId(),delivery.getExpiresAt());
        assertEquals("CANCELED",delivery.getStatus());
        verify(transport,times(1)).send(any(),any());
    }
}
