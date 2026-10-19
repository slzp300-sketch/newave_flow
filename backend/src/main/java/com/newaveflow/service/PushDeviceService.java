package com.newaveflow.service;

import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service @RequiredArgsConstructor @Transactional
public class PushDeviceService {
    private final UserRepository users;
    private final PushDeviceRepository devices;
    private final PushDeliveryRepository deliveries;
    private final NotificationPreferenceRepository preferences;
    private final PushTransport transport;
    private final jakarta.persistence.EntityManager entityManager;
    @org.springframework.beans.factory.annotation.Value("${PUSH_ENABLED:false}") private boolean pushAvailable;
    @org.springframework.beans.factory.annotation.Value("${NOTIFICATIONS_ENABLED:false}") private boolean notificationsEnabled;
    public record Registration(String platform, String token, String appVersion) {}
    public record Preference(boolean pushEnabled, boolean available) {}
    public record PreferenceRequest(Boolean pushEnabled) {}

    public Preference preference(Long userId) {
        return preference(userId,null);
    }
    public Preference preference(Long userId,String platform) {
        if(platform!=null && !Set.of("IOS","ANDROID").contains(platform)) throw AppException.badRequest("지원하는 플랫폼을 선택해주세요.");
        return new Preference(preferences.findById(userId).map(NotificationPreference::isPushEnabled).orElse(false),
                notificationsEnabled && pushAvailable && (platform==null?transport.available():transport.available(platform)));
    }
    public Preference preference(Long userId, boolean enabled) {
        users.lockById(userId).orElseThrow(() -> AppException.unauthorized("계정을 확인해주세요."));
        preferences.save(new NotificationPreference(userId,enabled));
        return preference(userId);
    }
    public void register(Long userId, long expectedAuthVersion, String id, Registration request) {
        validateId(id);
        if (request == null || !Set.of("IOS","ANDROID").contains(Objects.toString(request.platform(),""))
                || request.token()==null || request.token().length()<16 || request.token().length()>4096
                || !request.token().matches("[A-Za-z0-9_:.\\-]+")
                || ("IOS".equals(request.platform()) && (!request.token().matches("[a-fA-F0-9]{32,512}") || request.token().length()%2!=0))
                || request.appVersion()!=null && request.appVersion().length()>50) {
            throw AppException.badRequest("기기 등록 정보를 확인해주세요.");
        }
        var user=users.lockById(userId).orElseThrow(() -> AppException.unauthorized("계정을 확인해주세요."));
        // Authentication may have happened before a concurrent logout/status change.
        // Refresh under the same lock, including when the request already cached this user.
        entityManager.refresh(user,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        if(!user.isActive() || user.isSuspended() || user.getAuthVersion()!=expectedAuthVersion)
            throw AppException.unauthorized("로그인 상태가 변경되었습니다. 다시 로그인해주세요.");
        String token = "IOS".equals(request.platform()) ? request.token().toLowerCase(Locale.ROOT) : request.token();
        String hash = AppleClient.sha256(request.platform()+":"+token);
        devices.findByTokenHash(hash).filter(d -> !d.getInstallationId().equals(id)).ifPresent(d -> {
            deliveries.deleteByInstallationId(d.getInstallationId()); devices.delete(d); devices.flush();
        });
        var device=devices.lockById(id).orElseGet(PushDevice::new);
        if (device.getUserId()!=null && !device.getUserId().equals(userId)) deliveries.deleteByInstallationId(id);
        device.setInstallationId(id); device.setUserId(userId); device.setPlatform(request.platform());
        device.setToken(token); device.setTokenHash(hash); device.setAppVersion(request.appVersion());
        device.setActive(true); device.setUpdatedAt(Instant.now()); devices.save(device);
    }
    public void unregister(Long userId,String id) {
        validateId(id);
        devices.lockById(id).filter(d -> d.getUserId().equals(userId)).ifPresent(d -> {
            deliveries.deleteByInstallationId(id); devices.delete(d);
        });
    }
    private static void validateId(String id) {
        if(id==null || !id.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"))
            throw AppException.badRequest("기기 식별자를 확인해주세요.");
    }
}
