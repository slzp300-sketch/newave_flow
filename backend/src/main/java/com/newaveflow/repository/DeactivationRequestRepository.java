package com.newaveflow.repository;

import com.newaveflow.entity.DeactivationRequest;
import com.newaveflow.entity.DeactivationRequest.Status;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DeactivationRequestRepository extends JpaRepository<DeactivationRequest, Long> {
    List<DeactivationRequest> findByStatusOrderByRequestedAtDesc(Status status);
    Optional<DeactivationRequest> findByStudentIdAndStatus(Long studentId, Status status);
    boolean existsByStudentIdAndStatus(Long studentId, Status status);
    List<DeactivationRequest> findByStudentIdIn(List<Long> studentIds);
}
