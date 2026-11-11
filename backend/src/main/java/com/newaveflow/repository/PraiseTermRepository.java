package com.newaveflow.repository;
import com.newaveflow.entity.PraiseTerm;
import org.springframework.data.jpa.repository.*;
import java.util.*;
public interface PraiseTermRepository extends JpaRepository<PraiseTerm,Long> {
 List<PraiseTerm> findAllByOrderByTermYearDescHalfDesc();
 Optional<PraiseTerm> findByTermYearAndHalf(int year,int half);
 @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE) @Query("select t from PraiseTerm t where t.id=:id") Optional<PraiseTerm> lockById(@org.springframework.data.repository.query.Param("id") Long id);
}
