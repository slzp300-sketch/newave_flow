package com.newaveflow.repository;

import com.newaveflow.entity.UserStatusEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface UserStatusEventRepository extends JpaRepository<UserStatusEvent, Long> {
    List<UserStatusEvent> findTop100ByUserIdOrderByCreatedAtDescIdDesc(Long userId);
}
