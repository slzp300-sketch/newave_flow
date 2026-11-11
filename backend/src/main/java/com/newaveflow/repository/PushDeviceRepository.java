package com.newaveflow.repository;
import com.newaveflow.entity.PushDevice;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface PushDeviceRepository extends JpaRepository<PushDevice,String> {
    List<PushDevice> findByUserIdAndActiveTrue(Long userId);
    Optional<PushDevice> findByTokenHash(String tokenHash);
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from PushDevice d where d.installationId=:id")
    Optional<PushDevice> lockById(@Param("id") String id);
}
