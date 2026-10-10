package com.newaveflow.repository;

import com.newaveflow.entity.EvangelismGroup;
import com.newaveflow.entity.EvangelismGroupMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EvangelismGroupMemberRepository extends JpaRepository<EvangelismGroupMember, Long> {

    List<EvangelismGroupMember> findByTeacherId(Long teacherId);
    @org.springframework.data.jpa.repository.Query("SELECT m FROM EvangelismGroupMember m JOIN FETCH m.group g WHERE m.teacher.id = :teacherId AND g.isActive = true ORDER BY m.id")
    List<EvangelismGroupMember> findActiveByTeacherId(@org.springframework.data.repository.query.Param("teacherId") Long teacherId);

    Optional<EvangelismGroupMember> findByGroupAndTeacherId(EvangelismGroup group, Long teacherId);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM EvangelismGroupMember m WHERE m.group.id = :groupId")
    void deleteByGroupId(@org.springframework.data.repository.query.Param("groupId") Long groupId);
}
