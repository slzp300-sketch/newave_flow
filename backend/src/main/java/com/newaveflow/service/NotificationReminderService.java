package com.newaveflow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class NotificationReminderService {
    private final UserRepository users;
    private final NotificationService notifications;
    private final EventRepository events;
    private final EventRosterService roster;
    private final DailyReportRepository reports;
    private final MeetingAttendanceRepository meetings;
    private final TtsService tts;
    private final ObjectMapper json;
    private final EvangelismScheduleRepository evangelism;
    @Value("${NOTIFICATIONS_ENABLED:false}") private boolean enabled;

    @Transactional
    public void run(LocalDate today) {
        if(!enabled) return;
        var teachers=users.findAllActiveWithClasses().stream().filter(NotificationReminderService::teacher).toList();
        eventDeadlines(today);
        DayOfWeek day=today.getDayOfWeek();
        if(day==DayOfWeek.SUNDAY || day==DayOfWeek.TUESDAY) attendance(today,teachers);
        if(day==DayOfWeek.WEDNESDAY || day==DayOfWeek.SATURDAY) tts(today,teachers);
        if(day==DayOfWeek.FRIDAY) meetingVote(today,teachers);
        if(day==DayOfWeek.MONDAY || day==DayOfWeek.FRIDAY) evangelism(today);
    }
    private static boolean teacher(User u) {
        return u.isActive() && !u.isSuspended() && (u.getRole()==User.Role.TEACHER || u.getRole()==User.Role.EXECUTIVE);
    }
    private void send(User user,String key,String title,String body,Notification.NotificationType type,String path) {
        notifications.enqueue(user.getId(),key,title,body,type,path);
    }
    private void eventDeadlines(LocalDate today) {
        for(var event:events.findByAttendanceRequiredTrueOrderByEventDateDesc()) {
            LocalDate deadline=event.getAttendanceDeadline()!=null?event.getAttendanceDeadline():event.getEndDate()!=null?event.getEndDate():event.getEventDate();
            if(deadline==null || !(today.equals(deadline)||today.equals(deadline.minusDays(3)))
                    || event.getAttendanceStartDate()!=null && today.isBefore(event.getAttendanceStartDate())) continue;
            Set<Long> missingTeachers=event.getAttendanceTarget()==Event.AttendanceTarget.STUDENT_ONLY?Set.of():roster.teacherSummary(event.getId()).stream()
                    .filter(r -> r.status()==null).map(r -> r.teacherId()).collect(Collectors.toSet());
            Set<Long> missingClasses=event.getAttendanceTarget()==Event.AttendanceTarget.TEACHER_ONLY?Set.of():roster.studentRecords(event.getId()).stream()
                    .filter(r -> r.status()==null).map(r -> r.classGroupId()).collect(Collectors.toSet());
            for(var user:users.findAllActiveWithClasses()) {
                boolean missing=missingTeachers.contains(user.getId()) || user.getTeacherClasses().stream().anyMatch(c -> missingClasses.contains(c.getClassGroup().getId()));
                if(missing) send(user,"event-deadline:"+event.getId()+":"+deadline+":"+today,"행사 출석 응답 안내",
                        today.equals(deadline)?"오늘은 행사 출석 응답 마감일입니다. 아직 제출하지 않은 응답을 확인해주세요.":"행사 출석 응답 마감이 3일 남았습니다. 아직 제출하지 않은 응답을 확인해주세요.",
                        Notification.NotificationType.EVENT_DEADLINE,"/event-attendance/"+event.getId());
            }
        }
    }
    private void attendance(LocalDate today,List<User> teachers) {
        LocalDate sunday=today.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
        Set<Long> completed=reports.findByReportDate(sunday).stream().filter(r -> r.getStatus()==DailyReport.Status.SUBMITTED)
                .map(r -> r.getClassGroup().getId()).collect(Collectors.toSet());
        for(var user:teachers) if(user.getTeacherClasses().stream().anyMatch(c -> !completed.contains(c.getClassGroup().getId()))) {
            send(user,"attendance:"+sunday+":"+today,"주일 출석·보고 안내",
                    today.getDayOfWeek()==DayOfWeek.SUNDAY?"오늘 주일 출석과 우리 반 보고를 확인해주세요. 같은 반 선생님이 제출하면 함께 완료됩니다.":"아직 제출되지 않은 우리 반 주일 출석·보고를 확인해주세요. 오늘은 제출 안내일이며 이후에도 수정할 수 있습니다.",
                    Notification.NotificationType.ATTENDANCE,"/attendance");
        }
    }
    private void tts(LocalDate today,List<User> teachers) {
        LocalDate sunday=today.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
        if(!TtsPeriod.includes(TtsService.weekYear(sunday),TtsService.weekNum(sunday))) return;
        var questions=tts.getActiveQuestions(sunday);
        for(var user:teachers) {
            var week=tts.getWeek(user,sunday);
            if(week.isImportedPeriod()) continue;
            var answers=week.getAnswers().stream().collect(Collectors.toMap(a -> a.getQuestionId(),a -> a.getAnswerData(),(a,b)->a));
            boolean missing=false;
            for(var question:questions) {
                if(question.getType()!=TtsQuestion.TtsQuestionType.DAYS || TtsService.isLinked(question)) continue;
                Map<String,Boolean> days=Map.of();
                try { if(answers.containsKey(question.getId())) days=json.readValue(answers.get(question.getId()),new TypeReference<>(){}); } catch(Exception ignored) { }
                if(days==null) days=Map.of();
                for(int i=0;i<TtsService.DAY_LABELS.size();i++) {
                    LocalDate date=sunday.plusDays(i+1);
                    if(date.isBefore(today) && date.getYear()==today.getYear() && (date.getMonthValue()-1)/3==(today.getMonthValue()-1)/3
                            && !Boolean.TRUE.equals(days.get(TtsService.DAY_LABELS.get(i)))) missing=true;
                }
            }
            if(missing) send(user,"tts:"+sunday+":"+today,"이번 주 TTS 기록 안내","이번 주 지난 날짜에 체크하지 않은 TTS 항목이 있어요. 기록을 확인해주세요.",Notification.NotificationType.TTS,"/tts");
        }
    }
    private void meetingVote(LocalDate today,List<User> teachers) {
        LocalDate saturday=today.with(TemporalAdjusters.nextOrSame(DayOfWeek.SATURDAY));
        Set<Long> responded=meetings.findByMeetingDate(saturday).stream().map(a -> a.getTeacher().getId()).collect(Collectors.toSet());
        for(var user:teachers) if(!responded.contains(user.getId())) send(user,"meeting-vote:"+saturday,"교사회의 참석 응답 안내",
                "이번 주 토요일 교사회의 참석 여부를 아직 응답하지 않았어요. 참석·불참을 선택해주세요.",Notification.NotificationType.MEETING_VOTE,"/meeting/sat");
    }
    private void evangelism(LocalDate today) {
        LocalDate monday=today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        for(var schedule:evangelism.findUpcomingWithAssignments(today)) {
            if(!"ACTIVE".equals(schedule.getStatus()) || schedule.getScheduledDate().isAfter(monday.plusDays(6))) continue;
            String when = today.getDayOfWeek()==DayOfWeek.MONDAY ? "이번 주" : schedule.getScheduledDate().equals(today.plusDays(1)) ? "내일"
                    : schedule.getScheduledDate().getMonthValue()+"월 "+schedule.getScheduledDate().getDayOfMonth()+"일";
            schedule.getAssignments().stream().map(a -> a.getTeacher()).filter(NotificationReminderService::teacher).map(User::getId).distinct().forEach(id ->
                notifications.enqueue(id,"evangelism:"+schedule.getId()+":"+schedule.getScheduledDate()+":"+today,"이번 주 전도 로테이션 안내",
                        when+" 전도 로테이션입니다. 배정된 일정과 담당 내용을 확인해주세요.",Notification.NotificationType.EVANGELISM,"/evangelism"));
        }
    }
}
