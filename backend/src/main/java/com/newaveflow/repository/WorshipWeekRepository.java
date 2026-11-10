package com.newaveflow.repository;
import com.newaveflow.entity.WorshipWeek;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
public interface WorshipWeekRepository extends JpaRepository<WorshipWeek,LocalDate> {}
