package com.newaveflow.repository;

import com.newaveflow.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByName(String name);
    boolean existsByEmail(String email);
    List<User> findByRoleAndIsActiveTrue(User.Role role);
    List<User> findByIsActiveTrue();
    List<User> findByIsActiveFalse();
}
