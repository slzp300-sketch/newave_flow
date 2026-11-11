package com.newaveflow.repository;
import com.newaveflow.entity.WorshipTask;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
public interface WorshipTaskRepository extends JpaRepository<WorshipTask,Long> {
 List<WorshipTask> findByWeekWorshipDate(LocalDate date);
}
