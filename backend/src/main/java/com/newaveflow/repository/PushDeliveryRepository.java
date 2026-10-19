package com.newaveflow.repository;
import com.newaveflow.entity.PushDelivery;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;
import java.time.Instant;
import java.util.*;
public interface PushDeliveryRepository extends JpaRepository<PushDelivery,Long> {
    @Query("""
        select d.id from PushDelivery d, PushDevice device
        where d.installationId=device.installationId and d.status='PENDING' and d.nextAttemptAt<=:now
          and (d.expiresAt<=:now or device.platform in :platforms)
        order by d.nextAttemptAt, d.id
        """)
    List<Long> findDueIds(@Param("now") Instant now, @Param("platforms") Collection<String> platforms, Pageable page);
    @Query("select n.user.id from PushDelivery d, Notification n where d.id=:id and d.notificationId=n.id")
    Optional<Long> findOwnerIdById(@Param("id") Long id);
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from PushDelivery d where d.id=:id")
    Optional<PushDelivery> lockById(@Param("id") Long id);
    void deleteByInstallationId(String installationId);
}
