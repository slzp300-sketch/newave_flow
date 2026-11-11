package com.newaveflow.repository;
import com.newaveflow.entity.StudentCareChange;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface StudentCareChangeRepository extends JpaRepository<StudentCareChange,Long> {
 @Query("select c from StudentCareChange c left join fetch c.actor where c.record.student.id=:id order by c.id desc")
 List<StudentCareChange> forStudent(@Param("id") Long id);
}
