package com.newaveflow.repository;

import com.newaveflow.entity.EvangelismGroup;
import com.newaveflow.entity.EvangelismGroupMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EvangelismGroupMemberRepository extends JpaRepository<EvangelismGroupMember, Long> {

    List<EvangelismGroupMember> findByTeacherId(Long teacherId);

    Optional<EvangelismGroupMember> findByGroupAndTeacherId(EvangelismGroup group, Long teacherId);

    void deleteByGroupId(Long groupId);
}
