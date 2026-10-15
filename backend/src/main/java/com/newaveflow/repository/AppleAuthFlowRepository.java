package com.newaveflow.repository;

import com.newaveflow.entity.AppleAuthFlow;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.Optional;

public interface AppleAuthFlowRepository extends JpaRepository<AppleAuthFlow, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from AppleAuthFlow f where f.id = :id")
    Optional<AppleAuthFlow> lockById(@Param("id") String id);
    @Modifying @Query("delete from AppleAuthFlow f where f.expiresAt < :now")
    void deleteExpired(@Param("now") Instant now);
}
