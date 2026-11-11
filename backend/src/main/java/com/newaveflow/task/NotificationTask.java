package com.newaveflow.task;

import com.newaveflow.service.NotificationReminderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.*;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationTask {

    private final NotificationReminderService reminders;
    @Scheduled(cron="0 0 9 * * *",zone="Asia/Seoul")
    public void remind() { reminders.run(LocalDate.now(ZoneId.of("Asia/Seoul"))); }
}
