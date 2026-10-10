package com.newaveflow.repository;

import com.newaveflow.entity.EvangelismGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface EvangelismGroupRepository extends JpaRepository<EvangelismGroup, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT g FROM EvangelismGroup g ORDER BY g.id")
    java.util.List<EvangelismGroup> lockGroups();

    @Query("SELECT g FROM EvangelismGroup g LEFT JOIN FETCH g.members m LEFT JOIN FETCH m.teacher WHERE g.isActive = true ORDER BY g.id")
    List<EvangelismGroup> findAllActiveWithMembers();
}
