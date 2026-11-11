package com.newaveflow.repository;
import com.newaveflow.entity.StudentCareRecord;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface StudentCareRecordRepository extends JpaRepository<StudentCareRecord,Long> {
 @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE) @Query("select r from StudentCareRecord r where r.id=:id")
 Optional<StudentCareRecord> lockById(@Param("id") Long id);
 @Query("select r from StudentCareRecord r left join fetch r.author where r.student.id in :ids order by r.createdAt desc,r.id desc")
 List<StudentCareRecord> forStudents(@Param("ids") Collection<Long> ids);
}
