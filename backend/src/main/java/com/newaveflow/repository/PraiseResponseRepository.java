package com.newaveflow.repository;
import com.newaveflow.entity.PraiseResponse;
import org.springframework.data.jpa.repository.*;
import java.util.*;
public interface PraiseResponseRepository extends JpaRepository<PraiseResponse,Long> {
 List<PraiseResponse> findByTermId(Long termId);
}
