package com.newaveflow.repository;

import com.newaveflow.entity.CompletedOperation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface CompletedOperationRepository extends JpaRepository<CompletedOperation, Long> {
    Optional<CompletedOperation> findByActorIdAndOperationKey(Long actorId, String operationKey);
}
