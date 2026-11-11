package com.newaveflow.repository;
import com.newaveflow.entity.PraisePrayer;
import org.springframework.data.jpa.repository.*;
import java.util.*;
public interface PraisePrayerRepository extends JpaRepository<PraisePrayer,Long> {
 List<PraisePrayer> findByTermIdOrderByMeetingDate(Long termId);
}
