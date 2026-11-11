package com.newaveflow.repository;
import com.newaveflow.entity.PraiseMember;
import org.springframework.data.jpa.repository.*;
import java.util.*;
public interface PraiseMemberRepository extends JpaRepository<PraiseMember,Long> {
 List<PraiseMember> findByTermIdOrderById(Long termId);
 boolean existsByUserIdAndActiveTrue(Long userId);
}
