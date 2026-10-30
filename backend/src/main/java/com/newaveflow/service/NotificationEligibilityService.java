package com.newaveflow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

/** Rechecks live business state immediately before a queued push, including retries. */
@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class NotificationEligibilityService {
    private final EventRepository events;
    private final EventRosterService roster;
    private final DailyReportRepository reports;
    private final MeetingAttendanceRepository meetings;
    private final MeetingMinuteRepository minutes;
    private final EvangelismScheduleRepository evangelism;
    private final TtsService tts;
    private final ObjectMapper json;
    public boolean relevant(Notification n,User user,LocalDate today) {
        try {
            String[] key=Objects.toString(n.getDedupeKey(),"").split(":");
            return switch(n.getType()) {
                case EVENT -> key.length==2 && key[0].equals("event-new") && events.existsById(Long.valueOf(key[1]));
                case EVENT_DEADLINE -> key.length==4 && key[0].equals("event-deadline") && today.equals(LocalDate.parse(key[3]))
                        && eventMissing(Long.valueOf(key[1]),LocalDate.parse(key[2]),user,today);
                case ATTENDANCE -> key.length==3 && key[0].equals("attendance") && today.equals(LocalDate.parse(key[2]))
                        && reportMissing(LocalDate.parse(key[1]),user);
                case TTS -> key.length==3 && key[0].equals("tts") && today.equals(LocalDate.parse(key[2]))
                        && LocalDate.parse(key[1]).equals(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY))) && ttsMissing(user,today);
                case MEETING_VOTE -> key.length==2 && key[0].equals("meeting-vote") && today.equals(LocalDate.parse(key[1]).minusDays(1))
                        && meetings.findByTeacherIdAndMeetingDate(user.getId(),LocalDate.parse(key[1])).isEmpty();
                case MINUTE -> key.length==2 && key[0].equals("minute-published") && minutes.findById(Long.valueOf(key[1]))
                        .filter(MeetingMinute::isActive).map(m -> meetings.findByTeacherIdAndMeetingDate(user.getId(),m.getMeetingDate())
                                .map(a -> "ABSENT".equals(a.getStatus())).orElse(false)).orElse(false);
                case EVANGELISM -> key.length==4 && key[0].equals("evangelism") && today.equals(LocalDate.parse(key[3]))
                        && evangelism.findById(Long.valueOf(key[1])).filter(s -> "ACTIVE".equals(s.getStatus()) && s.getScheduledDate().equals(LocalDate.parse(key[2]))
                        && !s.getScheduledDate().isBefore(today)).map(s -> s.getAssignments().stream().anyMatch(a -> a.getTeacher().getId().equals(user.getId()))).orElse(false);
                case SYSTEM -> true;
            };
        } catch(NumberFormatException | java.time.format.DateTimeParseException ignored) {
            // Malformed business keys are invalid. Database/read failures must propagate so the queue can retry.
            return false;
        }
    }
    private boolean eventMissing(Long id,LocalDate originalDeadline,User user,LocalDate today) {
        var event=events.findById(id).orElse(null);
        if(event==null || !event.isAttendanceRequired()) return false;
        LocalDate deadline=event.getAttendanceDeadline()!=null?event.getAttendanceDeadline():event.getEndDate()!=null?event.getEndDate():event.getEventDate();
        if(!originalDeadline.equals(deadline) || !(today.equals(deadline)||today.equals(deadline.minusDays(3)))
                || event.getAttendanceStartDate()!=null && today.isBefore(event.getAttendanceStartDate())) return false;
        if(event.getAttendanceTarget()!=Event.AttendanceTarget.STUDENT_ONLY && roster.teacherSummary(id).stream()
                .anyMatch(r -> r.teacherId().equals(user.getId()) && r.status()==null)) return true;
        if(event.getAttendanceTarget()==Event.AttendanceTarget.TEACHER_ONLY || user.getTeacherClasses()==null) return false;
        var classIds=user.getTeacherClasses().stream().map(c -> c.getClassGroup().getId()).collect(Collectors.toSet());
        return roster.studentRecords(id).stream().anyMatch(s -> classIds.contains(s.classGroupId()) && s.status()==null);
    }
    private boolean reportMissing(LocalDate sunday,User user) {
        var complete=reports.findByReportDate(sunday).stream().filter(r -> r.getStatus()==DailyReport.Status.SUBMITTED)
                .map(r -> r.getClassGroup().getId()).collect(Collectors.toSet());
        return user.getTeacherClasses()!=null && user.getTeacherClasses().stream().anyMatch(c -> !complete.contains(c.getClassGroup().getId()));
    }
    private boolean ttsMissing(User user,LocalDate today) {
        LocalDate sunday=today.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
        var week=tts.getWeek(user,sunday);
        if(week.isImportedPeriod()) return false;
        var answers=week.getAnswers().stream().collect(Collectors.toMap(a -> a.getQuestionId(),a -> a.getAnswerData(),(a,b)->a));
        for(var q:tts.getActiveQuestions(sunday)) {
            if(q.getType()!=TtsQuestion.TtsQuestionType.DAYS || TtsService.isLinked(q)) continue;
            Map<String,Boolean> days=Map.of();
            try { if(answers.containsKey(q.getId()))days=json.readValue(answers.get(q.getId()),new TypeReference<>(){}); } catch(Exception ignored) { }
            if(days==null)days=Map.of();
            for(int i=0;i<TtsService.DAY_LABELS.size();i++) {
                LocalDate date=sunday.plusDays(i+1);
                if(date.isBefore(today) && date.getYear()==today.getYear() && (date.getMonthValue()-1)/3==(today.getMonthValue()-1)/3
                        && !Boolean.TRUE.equals(days.get(TtsService.DAY_LABELS.get(i)))) return true;
            }
        }
        return false;
    }
}
