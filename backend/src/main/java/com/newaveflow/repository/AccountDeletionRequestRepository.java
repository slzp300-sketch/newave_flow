package com.newaveflow.repository;

import com.newaveflow.entity.AccountDeletionRequest;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.Optional;

public interface AccountDeletionRequestRepository extends JpaRepository<AccountDeletionRequest, String> {
    Optional<AccountDeletionRequest> findByUserId(Long userId);
    boolean existsByUserId(Long userId);
    Optional<AccountDeletionRequest> findByReceiptTokenHash(String hash);
    @Modifying
    @Query("DELETE FROM AccountDeletionRequest r WHERE r.status = :status AND r.completedAt < :before")
    int deleteCompletedBefore(@Param("before") Instant before, @Param("status") AccountDeletionRequest.Status status);
}
