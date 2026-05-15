package com.newaveflow.repository;

import com.newaveflow.entity.UserTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface UserTagRepository extends JpaRepository<UserTag, Long> {

    @Query("SELECT ut FROM UserTag ut JOIN FETCH ut.tag JOIN FETCH ut.user")
    List<UserTag> findAllWithTag();

    boolean existsByUser_IdAndTag_Id(Long userId, Long tagId);

    @Modifying
    @Transactional
    void deleteByUser_IdAndTag_Id(Long userId, Long tagId);

    @Modifying
    @Transactional
    void deleteByTag_Id(Long tagId);
}
