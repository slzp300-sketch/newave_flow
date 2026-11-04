package com.newaveflow.repository;
import com.newaveflow.entity.IntercessionMeeting;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
public interface IntercessionMeetingRepository extends JpaRepository<IntercessionMeeting,LocalDate> {}
