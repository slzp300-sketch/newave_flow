package com.newaveflow.service;

import com.newaveflow.entity.PrayerVote;
import com.newaveflow.entity.User;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.PrayerVoteRepository;
import com.newaveflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PrayerVoteService {

    private final PrayerVoteRepository prayerVoteRepository;
    private final UserRepository userRepository;
    private final com.newaveflow.repository.TeacherClassRepository teacherClassRepository;

    // 해당 날짜가 속한 주의 월요일
    public static LocalDate getWeekStart(LocalDate date) {
        return date.with(DayOfWeek.MONDAY);
    }

    // 투표 가능 여부: 월~목
    public static boolean isVoteWindowOpen(LocalDate date) {
        DayOfWeek day = date.getDayOfWeek();
        return day == DayOfWeek.MONDAY || day == DayOfWeek.TUESDAY
            || day == DayOfWeek.WEDNESDAY || day == DayOfWeek.THURSDAY;
    }

    public Optional<PrayerVote> getMyVote(Long teacherId, LocalDate weekStart) {
        return prayerVoteRepository.findByTeacherIdAndWeekStart(teacherId, weekStart);
    }

    @Transactional
    public PrayerVote saveVote(Long teacherId, LocalDate weekStart, String statusStr, String reason) {
        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> AppException.notFound("교사를 찾을 수 없습니다."));

        PrayerVote.Status status = PrayerVote.Status.valueOf(statusStr);

        PrayerVote vote = prayerVoteRepository.findByTeacherIdAndWeekStart(teacherId, weekStart)
                .orElseGet(() -> PrayerVote.builder()
                        .teacher(teacher)
                        .weekStart(weekStart)
                        .status(status)
                        .build());

        vote.update(status, reason);
        return prayerVoteRepository.save(vote);
    }

    public List<PrayerVote> getAbsentList(LocalDate weekStart) {
        return prayerVoteRepository.findAbsentByWeekStart(weekStart);
    }

    public List<PrayerVote> getAllVotes(LocalDate weekStart) {
        return prayerVoteRepository.findAllByWeekStart(weekStart);
    }

    public List<com.newaveflow.dto.prayer.PrayerVoteResponse> getAbsentListResponses(LocalDate weekStart) {
        List<PrayerVote> votes = prayerVoteRepository.findAbsentByWeekStart(weekStart);
        
        // N+1 문제 해결을 위해 교사들의 반 배정 정보를 한 번에 조회합니다.
        List<Long> teacherIds = votes.stream().map(v -> v.getTeacher().getId()).toList();
        java.util.Map<Long, java.util.List<com.newaveflow.entity.TeacherClass>> teacherClassMap = 
            teacherClassRepository.findByTeacherIdIn(teacherIds).stream()
                .collect(java.util.stream.Collectors.groupingBy(tc -> tc.getTeacher().getId()));

        return votes.stream().map(v -> {
            String className = null;
            java.util.List<com.newaveflow.entity.TeacherClass> tcs = teacherClassMap.get(v.getTeacher().getId());
            if (tcs != null && !tcs.isEmpty()) {
                className = tcs.get(0).getClassGroup().getDescription();
            }
            return new com.newaveflow.dto.prayer.PrayerVoteResponse(v, className);
        }).toList();
    }

    @Transactional
    public PrayerVote toggleScriptureSubmitted(Long voteId, boolean submitted) {
        PrayerVote vote = prayerVoteRepository.findByIdWithTeacher(voteId)
                .orElseThrow(() -> AppException.notFound("투표 기록을 찾을 수 없습니다."));
        if (submitted) vote.markScriptureSubmitted();
        else vote.unmarkScriptureSubmitted();
        return prayerVoteRepository.save(vote);
    }
}
