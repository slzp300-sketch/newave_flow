package com.newaveflow.service;

import com.newaveflow.dto.prayer.PrayerParticipationResponse;
import com.newaveflow.dto.prayer.PrayerParticipationResponse.Person;
import com.newaveflow.dto.prayer.PrayerParticipationResponse.Summary;
import com.newaveflow.dto.prayer.PrayerVoteResponse;
import com.newaveflow.entity.PrayerVote;
import com.newaveflow.entity.User;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.PrayerVoteRepository;
import com.newaveflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PrayerParticipationService {
    private final PrayerVoteRepository votes;
    private final UserRepository users;

    public PrayerParticipationResponse get(LocalDate requestedWeek) {
        LocalDate week = PrayerVoteService.getWeekStart(requestedWeek);
        LocalDate currentWeek = PrayerVoteService.getWeekStart(LocalDate.now(ZoneId.of("Asia/Seoul")));
        if (week.isAfter(currentWeek)) throw AppException.badRequest("다음 주 자료는 아직 조회할 수 없습니다.");
        if (week.isBefore(LocalDate.of(2000, 1, 3))) throw AppException.badRequest("조회 주차를 확인해주세요.");

        // Historical response totals use saved votes, not today's membership count.
        // Only unanswered rows depend on the currently active roster and join date.
        var roster = users.findAllActiveWithClasses().stream()
                .filter(u -> !u.isSuspended() && u.participatesInTeacherActivities()).toList();
        var byWeek = votes.findWithTeacherByWeekStartBetween(week.minusWeeks(7), week).stream()
                .collect(Collectors.groupingBy(PrayerVote::getWeekStart));
        List<Summary> trend = new ArrayList<>();
        List<Person> selectedPeople = List.of();
        for (int i = 7; i >= 0; i--) {
            LocalDate target = week.minusWeeks(i);
            List<Person> people = people(target, roster, byWeek.getOrDefault(target, List.of()));
            trend.add(summarize(target, people));
            if (target.equals(week)) selectedPeople = people;
        }
        return new PrayerParticipationResponse(week, trend.get(trend.size() - 1), selectedPeople, trend);
    }

    private List<Person> people(LocalDate week, List<User> roster, List<PrayerVote> records) {
        Map<Long, Person> people = new LinkedHashMap<>();
        for (User user : roster) {
            if (user.getCreatedAt() != null && user.getCreatedAt().toLocalDate().isAfter(week.plusDays(6))) continue;
            people.put(user.getId(), new Person(user.getId(), user.getName(),
                    grade(user), "UNKNOWN", "", null));
        }
        for (PrayerVote vote : records) {
            var value = new PrayerVoteResponse(vote);
            people.put(value.getTeacherId(), new Person(value.getTeacherId(), value.getTeacherName(),
                    grade(vote.getTeacher()), value.getStatus(), value.getReason(), value.getUpdatedAt()));
        }
        return people.values().stream().sorted(Comparator.comparing(Person::teacherName)
                .thenComparing(Person::teacherId)).toList();
    }

    private Summary summarize(LocalDate week, List<Person> people) {
        int tue = 0, thu = 0, absent = 0, unanswered = 0;
        for (Person person : people) switch (person.status()) {
            case "TUE" -> tue++;
            case "THU" -> thu++;
            case "ABSENT" -> absent++;
            default -> unanswered++;
        }
        return new Summary(week, tue, thu, absent, unanswered);
    }

    private String grade(User user) {
        String profileGrade = PrayerVoteResponse.extractGrade(user.getGrade());
        if (!"미분류".equals(profileGrade) || user.getTeacherClasses() == null) return profileGrade;
        return user.getTeacherClasses().stream()
                .sorted(Comparator.comparing(com.newaveflow.entity.TeacherClass::isPrimary).reversed()
                        .thenComparing(com.newaveflow.entity.TeacherClass::getId))
                .map(tc -> tc.getClassGroup())
                .map(group -> PrayerVoteResponse.extractGrade(group.getAgeGroup() != null ? group.getAgeGroup() : group.getDescription()))
                .filter(value -> !"미분류".equals(value)).findFirst().orElse("미분류");
    }
}
