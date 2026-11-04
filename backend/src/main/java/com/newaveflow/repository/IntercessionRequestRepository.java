package com.newaveflow.repository;
import com.newaveflow.entity.IntercessionRequest;
import org.springframework.data.jpa.repository.*;
public interface IntercessionRequestRepository extends JpaRepository<IntercessionRequest,Long>,JpaSpecificationExecutor<IntercessionRequest> {}
