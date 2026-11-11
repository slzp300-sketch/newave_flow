package com.newaveflow.repository;
import com.newaveflow.entity.*;
import org.springframework.data.jpa.repository.*;
import java.util.*;
public interface OfficerAppointmentRepository extends JpaRepository<OfficerAppointment,Long> {
    @EntityGraph(attributePaths="user") List<OfficerAppointment> findByTermYear(int year);
    boolean existsByTermYearAndPositionAndUserId(int year, OfficerPosition position, Long userId);
}
