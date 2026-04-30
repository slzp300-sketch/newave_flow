package com.newaveflow.repository;

import com.newaveflow.entity.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface EventRepository extends JpaRepository<Event, Long> {
    
    @Query("SELECT e FROM Event e WHERE e.eventDate >= :fromDate AND e.eventDate <= :toDate ORDER BY e.eventDate ASC")
    List<Event> findByDateRange(@Param("fromDate") LocalDate fromDate, @Param("toDate") LocalDate toDate);

    List<Event> findByAttendanceRequiredTrueOrderByEventDateDesc();
}
