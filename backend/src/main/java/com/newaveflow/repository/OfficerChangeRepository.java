package com.newaveflow.repository;
import com.newaveflow.entity.OfficerChange;
import org.springframework.data.jpa.repository.*;
import java.util.*;
public interface OfficerChangeRepository extends JpaRepository<OfficerChange,Long> {
    @EntityGraph(attributePaths={"actor","previousUser","nextUser"})
    List<OfficerChange> findTop50ByTermYearOrderByChangedAtDescIdDesc(int year);
}
