package com.newaveflow;

import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest(showSql=false,properties={"NOTIFICATIONS_ENABLED=true","PUSH_ENABLED=true"}) @ActiveProfiles("test")
@Import({NotificationService.class,PushDeviceService.class,PushDeliveryService.class})
class NotificationPipelineTest {
    @Autowired UserRepository users;
    @Autowired NotificationRepository notifications;
    @Autowired PushDeviceRepository devices;
    @Autowired PushDeliveryRepository deliveries;
    @Autowired NotificationService service;
    @Autowired PushDeviceService registration;
    @Autowired PushDeliveryService worker;
    @Autowired jakarta.persistence.EntityManager entityManager;
    @MockBean PushTransport transport;
    @MockBean NotificationEligibilityService eligibility;
    final String installation="11111111-1111-4111-8111-111111111111";
    @BeforeEach void setup() {
        ReflectionTestUtils.setField(service,"notificationsEnabled",true);
        when(transport.available()).thenReturn(true);
        when(transport.available(anyString())).thenReturn(true);
        when(eligibility.relevant(any(),any(),any())).thenReturn(true);
    }
    User account(String name) { return users.saveAndFlush(User.builder().name("Synthetic "+name).email(name+"@example.invalid").password("synthetic").role(User.Role.TEACHER).build()); }
    void register(User u) {
        registration.register(u.getId(),u.getAuthVersion(),installation,new PushDeviceService.Registration("IOS","a".repeat(64),"1.0.1"));
        registration.preference(u.getId(),true);
    }
    void enqueue(User u,String key) { service.enqueue(u.getId(),key,"Synthetic notice","Synthetic body",Notification.NotificationType.TTS,"/tts"); }

    @Test void sameBusinessKeyCreatesOneNotificationAndOneDelivery() {
        var u=account("dedupe"); register(u); enqueue(u,"tts:2026-10-14"); enqueue(u,"tts:2026-10-14");
        assertEquals(1,notifications.count()); assertEquals(1,deliveries.count());
        assertEquals("/tts",notifications.findAll().get(0).getTargetPath());
        verify(transport,never()).send(any(),any());
    }
    @Test void defaultOptOutStillReceivesInAppNoticeWithoutPush() {
        var u=account("optout"); registration.register(u.getId(),u.getAuthVersion(),installation,new PushDeviceService.Registration("IOS","b".repeat(64),null));
        assertFalse(registration.preference(u.getId()).pushEnabled()); enqueue(u,"one");
        assertEquals(1,notifications.count()); assertEquals(0,deliveries.count());
    }
    @Test void logoutOnlyRemovesOwnDeviceAndItsQueuedDeliveries() {
        var u=account("owner");var other=account("other");register(u);enqueue(u,"queued");
        registration.unregister(other.getId(),installation); assertEquals(1,devices.count());
        registration.unregister(u.getId(),installation); assertEquals(0,devices.count());assertEquals(0,deliveries.count());
    }
    @Test void accountSwitchCancelsOldOwnersQueuedPushAndKeepsOnlyOneToken() {
        var old=account("old");var next=account("next");register(old);enqueue(old,"queued");
        registration.register(next.getId(),next.getAuthVersion(),installation,new PushDeviceService.Registration("IOS","a".repeat(64),null));
        assertEquals(next.getId(),devices.findById(installation).orElseThrow().getUserId());assertEquals(0,deliveries.count());
        String second="22222222-2222-4222-8222-222222222222";
        registration.register(next.getId(),next.getAuthVersion(),second,new PushDeviceService.Registration("IOS","a".repeat(64),null));
        assertEquals(1,devices.count()); assertTrue(devices.findById(installation).isEmpty());
    }
    @Test void optingOutAfterQueueCancelsDeliveryWithoutProviderCall() {
        var u=account("cancel");register(u);enqueue(u,"queued");var d=deliveries.findAll().get(0);
        registration.preference(u.getId(),false);worker.deliver(d.getId(),Instant.now().plusSeconds(1));
        assertEquals("CANCELED",deliveries.findById(d.getId()).orElseThrow().getStatus());verify(transport,never()).send(any(),any());
    }
    @Test void lateRegistrationAuthenticatedBeforeLogoutCannotReclaimNextAccountsDevice() {
        var old=account("late-old");var next=account("late-next");register(old);
        long authenticatedVersion=old.getAuthVersion();
        // Reproduce a logout that committed after authentication, leaving a stale managed user.
        entityManager.createNativeQuery("UPDATE users SET auth_version=auth_version+1 WHERE id=:id")
                .setParameter("id",old.getId()).executeUpdate();
        assertEquals(authenticatedVersion,old.getAuthVersion());
        register(next); enqueue(next,"new-owner");
        assertThrows(com.newaveflow.exception.AppException.class,()->registration.register(old.getId(),authenticatedVersion,
                installation,new PushDeviceService.Registration("IOS","a".repeat(64),null)));
        assertEquals(next.getId(),devices.findById(installation).orElseThrow().getUserId());
        assertEquals(1,deliveries.count());
    }
    @Test void inactiveAccountCannotRegisterEvenWithItsLatestVersion() {
        var u=account("suspended-registration");u.suspend();users.saveAndFlush(u);
        assertThrows(com.newaveflow.exception.AppException.class,()->registration.register(u.getId(),u.getAuthVersion(),
                installation,new PushDeviceService.Registration("IOS","a".repeat(64),null)));
        assertEquals(0,devices.count());
    }
    @Test void retriesAreBoundedAndSuccessCannotSendTwice() {
        var u=account("retry");register(u);enqueue(u,"retry");var d=deliveries.findAll().get(0);
        when(transport.send(any(),any())).thenReturn(PushTransport.Result.RETRY);
        for(int i=0;i<5;i++) worker.deliver(d.getId(),d.getNextAttemptAt().plusSeconds(1));
        assertEquals("FAILED",d.getStatus());assertEquals(5,d.getAttempts());verify(transport,times(5)).send(any(),any());
        enqueue(u,"success");var second=deliveries.findAll().stream().filter(x -> !x.getId().equals(d.getId())).findFirst().orElseThrow();
        when(transport.send(any(),any())).thenReturn(PushTransport.Result.SENT);
        worker.deliver(second.getId(),Instant.now().plusSeconds(1));worker.deliver(second.getId(),Instant.now().plusSeconds(2));
        assertEquals("SENT",second.getStatus());verify(transport,times(6)).send(any(),any());
    }
    @Test void expiredAndUnavailableDeliveryNeverCallsProvider() {
        var u=account("expiry");register(u);enqueue(u,"expiry");var d=deliveries.findAll().get(0);
        worker.deliver(d.getId(),d.getExpiresAt().plusSeconds(1));assertEquals("CANCELED",d.getStatus());
        when(transport.available()).thenReturn(false);assertFalse(registration.preference(u.getId()).available());
        verify(transport,never()).send(any(),any());
    }
    @Test void completedWorkBeforeDeliveryCancelsQueuedReminder() {
        var u=account("completed");register(u);enqueue(u,"queued");var d=deliveries.findAll().get(0);
        when(eligibility.relevant(any(),any(),any())).thenReturn(false);
        worker.deliver(d.getId(),Instant.now().plusSeconds(1));assertEquals("CANCELED",d.getStatus());verify(transport,never()).send(any(),any());
    }
    @Test void availabilityIsSpecificToDevicePlatform() {
        var u=account("platform");when(transport.available("ANDROID")).thenReturn(false);
        assertTrue(registration.preference(u.getId(),"IOS").available());assertFalse(registration.preference(u.getId(),"ANDROID").available());
    }
    @Test void invalidProviderTokenIsErasedWithAllItsQueuedDeliveries() {
        var u=account("invalid-device");register(u);enqueue(u,"first");enqueue(u,"second");var d=deliveries.findAll().get(0);
        when(transport.send(any(),any())).thenReturn(PushTransport.Result.INVALID_DEVICE);
        worker.deliver(d.getId(),Instant.now().plusSeconds(1));
        assertEquals(0,devices.count());assertEquals(0,deliveries.count());assertEquals(2,notifications.count());
    }
    @Test void disabledMasterAndInvalidInputCannotCreateMessagesOrLeakDevice() {
        var u=account("disabled");ReflectionTestUtils.setField(service,"notificationsEnabled",false);enqueue(u,"off");assertEquals(0,notifications.count());
        assertThrows(RuntimeException.class,()->registration.register(u.getId(),u.getAuthVersion(),"bad",new PushDeviceService.Registration("IOS","not-a-token",null)));
        assertEquals(0,devices.count());assertFalse(NotificationService.safePath("https://example.invalid"));assertFalse(NotificationService.safePath("//example.invalid"));
        assertFalse(NotificationService.safePath("/admin/users"));assertTrue(NotificationService.safePath("/event-attendance/5"));
    }
}
