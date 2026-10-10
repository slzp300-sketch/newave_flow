package com.newaveflow.repository;

import com.newaveflow.entity.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface EventRepository extends JpaRepository<Event, Long> {
    
    // 기간과 하루라도 겹치는 일정 (앞 달에 시작해 이번 달까지 이어지는 일정 포함)
    @Query("SELECT e FROM Event e WHERE e.eventDate <= :toDate AND COALESCE(e.endDate, e.eventDate) >= :fromDate ORDER BY e.eventDate ASC")
    List<Event> findByDateRange(@Param("fromDate") LocalDate fromDate, @Param("toDate") LocalDate toDate);

    List<Event> findAllByOrderByEventDateAsc();

    List<Event> findByAttendanceRequiredTrueOrderByEventDateDesc();
}
