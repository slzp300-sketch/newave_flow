package com.newaveflow.repository;
import com.newaveflow.entity.NewFamilyRegistry;
import org.springframework.data.jpa.repository.*;
import java.util.*;
public interface NewFamilyRegistryRepository extends JpaRepository<NewFamilyRegistry,Long> {
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE) @Query("select r from NewFamilyRegistry r where r.id=1")
    Optional<NewFamilyRegistry> lockRegistry();
}
