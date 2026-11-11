package com.newaveflow.repository;
import com.newaveflow.entity.NewFamilyMember;
import org.springframework.data.jpa.repository.*;
import java.util.*;
public interface NewFamilyMemberRepository extends JpaRepository<NewFamilyMember,Long> {
    @Query("select m from NewFamilyMember m join fetch m.student s left join fetch s.classGroup order by s.name,m.id")
    List<NewFamilyMember> findRoster();
    Optional<NewFamilyMember> findByStudentId(Long id);
}
