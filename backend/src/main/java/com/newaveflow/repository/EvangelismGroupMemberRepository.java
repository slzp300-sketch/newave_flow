package com.newaveflow.repository;

import com.newaveflow.entity.EvangelismGroup;
import com.newaveflow.entity.EvangelismGroupMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EvangelismGroupMemberRepository extends JpaRepository<EvangelismGroupMember, Long> {

    List<EvangelismGroupMember> findByTeacherId(Long teacherId);

    Optional<EvangelismGroupMember> findByGroupAndTeacherId(EvangelismGroup group, Long teacherId);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM EvangelismGroupMember m WHERE m.group.id = :groupId")
    void deleteByGroupId(@org.springframework.data.repository.query.Param("groupId") Long groupId);
}
