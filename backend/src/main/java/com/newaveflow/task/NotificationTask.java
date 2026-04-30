package com.newaveflow.task;

import com.newaveflow.entity.Notification;
import com.newaveflow.entity.User;
import com.newaveflow.repository.UserRepository;
import com.newaveflow.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationTask {

    private final UserRepository userRepository;
    private final NotificationService notificationService;

    // 매주 주일 오전 8시에 출석 체크 독려 알림 (예: 0 0 8 * * SUN)
    @Scheduled(cron = "0 0 8 * * SUN", zone = "Asia/Seoul")
    public void remindSundayAttendance() {
        log.debug("Running remindSundayAttendance task");
        List<Long> activeUserIds = userRepository.findByIsActiveTrue().stream()
                .filter(u -> u.getRole() == User.Role.TEACHER || u.getRole() == User.Role.EXECUTIVE)
                .map(User::getId)
                .toList();

        notificationService.createNotificationForUsers(activeUserIds,
                "출석 체크 알림",
                "오늘은 주일입니다. 아이들 출석 체크를 잊지 마세요!",
                Notification.NotificationType.ATTENDANCE);
    }
    
    // 매주 월요일 오전 10시에 미제출 알림 (예: 0 0 10 * * MON)
    // 실제로는 미제출자를 조회해야 하나, 임시로 전체 교사에게 확인 독려.
    @Scheduled(cron = "0 0 10 * * MON", zone = "Asia/Seoul")
    public void remindMondayAttendance() {
        log.debug("Running remindMondayAttendance task");
        List<Long> activeUserIds = userRepository.findByIsActiveTrue().stream()
                .filter(u -> u.getRole() == User.Role.TEACHER || u.getRole() == User.Role.EXECUTIVE)
                .map(User::getId)
                .toList();

        notificationService.createNotificationForUsers(activeUserIds,
                "출석부 제출 마감 안내",
                "출석부 제출 기간이 오늘까지입니다. 미제출 내역이 없는지 확인해주세요.",
                Notification.NotificationType.ATTENDANCE);
    }
}
