package com.newaveflow.repository;

import com.newaveflow.entity.MeetingMinuteConfirm;
import com.newaveflow.entity.User;
import com.newaveflow.entity.MeetingMinute;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface MeetingMinuteConfirmRepository extends JpaRepository<MeetingMinuteConfirm, Long> {
    Optional<MeetingMinuteConfirm> findByMinutesAndUser(MeetingMinute minutes, User user);
    List<MeetingMinuteConfirm> findAllByMinutes(MeetingMinute minutes);

    @org.springframework.transaction.annotation.Transactional
    void deleteAllByMinutesId(Long minutesId);
}
