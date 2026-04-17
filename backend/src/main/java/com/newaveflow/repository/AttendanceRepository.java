package com.newaveflow.repository;

import com.newaveflow.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AttendanceRepository extends JpaRepository<Attendance, Long> {

    List<Attendance> findByClassGroupIdAndAttendanceDate(Long classGroupId, LocalDate date);

    Optional<Attendance> findByStudentIdAndAttendanceDate(Long studentId, LocalDate date);

    List<Attendance> findByStudentIdOrderByAttendanceDateDesc(Long studentId);

    @Query("""
        SELECT a FROM Attendance a
        JOIN FETCH a.student s
        WHERE a.classGroup.id = :classId
          AND a.attendanceDate = :date
        ORDER BY s.name
        """)
    List<Attendance> findByClassAndDate(@Param("classId") Long classId,
                                        @Param("date") LocalDate date);

    @Query("""
        SELECT COUNT(a) FROM Attendance a
        WHERE a.classGroup.id = :classId
          AND a.attendanceDate = :date
          AND a.status = 'PRESENT'
        """)
    long countPresentByClassAndDate(@Param("classId") Long classId,
                                    @Param("date") LocalDate date);
}
