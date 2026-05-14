package com.newaveflow.repository;

import com.newaveflow.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByEmailIgnoreCase(String email);
    Optional<User> findByName(String name);
    boolean existsByEmail(String email);
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByName(String name);
    List<User> findByRoleAndIsActiveTrue(User.Role role);
    List<User> findByIsActiveTrue();
    List<User> findByIsActiveFalse();
    
    @Query("SELECT DISTINCT u FROM User u LEFT JOIN FETCH u.teacherClasses tc LEFT JOIN FETCH tc.classGroup WHERE u.isActive = true")
    List<User> findAllActiveWithClasses();

    Optional<User> findByNameAndPhone(String name, String phone);

    Optional<User> findByEmailIgnoreCaseAndNameAndPhone(String email, String name, String phone);

    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.email = :newEmail WHERE u.email = :oldEmail")
    int updateEmailByExactMatch(@Param("oldEmail") String oldEmail, @Param("newEmail") String newEmail);
}
