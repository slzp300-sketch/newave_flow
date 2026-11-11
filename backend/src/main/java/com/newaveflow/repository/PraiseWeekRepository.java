package com.newaveflow.repository;
import com.newaveflow.entity.PraiseWeek;
import org.springframework.data.jpa.repository.*;
import java.util.*;
public interface PraiseWeekRepository extends JpaRepository<PraiseWeek,Long> {
 List<PraiseWeek> findByTermIdOrderByWorshipDate(Long termId);
}
