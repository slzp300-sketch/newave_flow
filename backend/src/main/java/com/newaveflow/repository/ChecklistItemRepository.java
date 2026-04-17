package com.newaveflow.repository;

import com.newaveflow.entity.ChecklistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ChecklistItemRepository extends JpaRepository<ChecklistItem, Long> {
    List<ChecklistItem> findAllByOrderByOrderIndexAsc();
}
