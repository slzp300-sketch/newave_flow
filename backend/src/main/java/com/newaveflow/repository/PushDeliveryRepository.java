package com.newaveflow.repository;
import com.newaveflow.entity.PushDelivery;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.*;
public interface PushDeliveryRepository extends JpaRepository<PushDelivery,Long> {
    List<PushDelivery> findTop100ByStatusAndNextAttemptAtLessThanEqualOrderById(String status, Instant now);
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from PushDelivery d where d.id=:id")
    Optional<PushDelivery> lockById(@Param("id") Long id);
    void deleteByInstallationId(String installationId);
}
