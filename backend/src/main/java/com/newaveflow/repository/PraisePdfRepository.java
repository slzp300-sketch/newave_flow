package com.newaveflow.repository;
import com.newaveflow.entity.PraisePdf;
import org.springframework.data.jpa.repository.*;
import java.util.*;
public interface PraisePdfRepository extends JpaRepository<PraisePdf,Long> {
 List<PraisePdf> findByWeekIdOrderByFileVersionDesc(Long weekId);
 Optional<PraisePdf> findFirstByWeekIdOrderByFileVersionDesc(Long weekId);
 @Query("select new com.newaveflow.repository.PraisePdfRepository$Metadata(p.id,p.week.id,p.fileVersion,p.uploadedAt,p.pageCount) from PraisePdf p where p.week.term.id=:termId order by p.fileVersion desc") List<Metadata> metadata(@org.springframework.data.repository.query.Param("termId") Long termId);
 record Metadata(Long id,Long weekId,int version,java.time.LocalDateTime uploadedAt,int pages) {}
}
