package com.newaveflow.repository;
import com.newaveflow.entity.TeacherWorshipAttendance;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
public interface TeacherWorshipAttendanceRepository extends JpaRepository<TeacherWorshipAttendance,Long> {
    Optional<TeacherWorshipAttendance> findByTeacherIdAndWorshipDate(Long teacherId, LocalDate date);
    Optional<TeacherWorshipAttendance> findFirstByTeacherIdOrderByWorshipDateDesc(Long teacherId);
    List<TeacherWorshipAttendance> findByWorshipDate(LocalDate date);
}
