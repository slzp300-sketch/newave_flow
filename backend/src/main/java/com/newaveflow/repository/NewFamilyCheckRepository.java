package com.newaveflow.repository;
import com.newaveflow.entity.NewFamilyCheck;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.*;
public interface NewFamilyCheckRepository extends JpaRepository<NewFamilyCheck,Long> {
    List<NewFamilyCheck> findByWorshipDate(LocalDate date);
    Optional<NewFamilyCheck> findByMemberIdAndWorshipDate(Long id,LocalDate date);
}
