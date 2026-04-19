package com.newaveflow.config;

import com.newaveflow.entity.*;
import com.newaveflow.entity.User.Role;
import com.newaveflow.repository.*;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitService {

    private final ChecklistItemRepository checklistItemRepository;
    private final EventRepository eventRepository;
    private final UserRepository userRepository;
    private final ClassGroupRepository classGroupRepository;
    private final StudentRepository studentRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final EvangelismGroupRepository evangelismGroupRepository;
    private final EvangelismGroupMemberRepository evangelismGroupMemberRepository;
    private final EvangelismScheduleRepository evangelismScheduleRepository;
    private final EvangelismAssignmentRepository evangelismAssignmentRepository;
    private final AttendanceRepository attendanceRepository;
    private final ChecklistRecordRepository checklistRecordRepository;
    private final DailyReportRepository dailyReportRepository;
    private final MeetingAttendanceRepository meetingAttendanceRepository;
    private final EventAttendanceRepository eventAttendanceRepository;
    private final MeetingMinuteRepository meetingMinuteRepository;
    private final MeetingMinuteConfirmRepository meetingMinuteConfirmRepository;
    private final PrayerVoteRepository prayerVoteRepository;
    private final EventStudentAttendanceRepository eventStudentAttendanceRepository;
    private final PasswordEncoder passwordEncoder;
    private final RosterDataInitService rosterDataInitService;

    @PostConstruct
    public void init() {
        // Force a total reset once to ensure all mappings are perfect
        log.info("Performing a fresh initialization of users and roster...");
        eventStudentAttendanceRepository.deleteAll();
        prayerVoteRepository.deleteAll();
        teacherClassRepository.deleteAll();
        attendanceRepository.deleteAll();
        dailyReportRepository.deleteAll();
        studentRepository.deleteAll();
        classGroupRepository.deleteAll();
        userRepository.deleteAll();

        List<User> teachers = initUsers();
        rosterDataInitService.initRosterData();
        
        initChecklistItems();
        initEvents();
        initEvangelism(teachers);
        initMeetingMinutes(teachers);
    }

    private List<User> initUsers() {
        String pw = passwordEncoder.encode("password123");
        
        User admin = User.builder().name("관리자").email("admin@church.com").password(pw).role(Role.ADMIN).build();
        User pastor = User.builder().name("목사님").email("pastor@church.com").password(pw).role(Role.PASTOR).build();
        
        // 학년별 1반 담임선생님들
        User m1 = User.builder().name("정미리암").email("miriam@church.com").password(pw).role(Role.TEACHER).grade("중1").build();
        User m2 = User.builder().name("김보경").email("bk.kim@church.com").password(pw).role(Role.TEACHER).grade("중2").build();
        User m3 = User.builder().name("최윤정").email("yj.choi@church.com").password(pw).role(Role.TEACHER).grade("중3").build();
        User h1 = User.builder().name("고연진").email("yj.ko@church.com").password(pw).role(Role.TEACHER).grade("고1").build();
        User h2 = User.builder().name("서하린").email("hr.seo@church.com").password(pw).role(Role.TEACHER).grade("고2").build();
        User h3 = User.builder().name("김하은").email("he.kim@church.com").password(pw).role(Role.TEACHER).grade("고3").build();

        return userRepository.saveAll(List.of(admin, pastor, m1, m2, m3, h1, h2, h3));
    }

    private void initClasses(List<User> users) {
        ClassGroup class1 = ClassGroup.builder().name("중등부 1반").ageGroup("중등").description("중1").build();
        ClassGroup class2 = ClassGroup.builder().name("고등부 1반").ageGroup("고등").description("고1").build();
        classGroupRepository.saveAll(List.of(class1, class2));

        User m1 = users.stream().filter(u -> u.getName().equals("정미리암")).findFirst().orElseThrow();
        User h1 = users.stream().filter(u -> u.getName().equals("고연진")).findFirst().orElseThrow();

        teacherClassRepository.save(TeacherClass.builder().teacher(m1).classGroup(class1).isPrimary(true).build());
        teacherClassRepository.save(TeacherClass.builder().teacher(h1).classGroup(class2).isPrimary(true).build());

        studentRepository.saveAll(List.of(
            Student.builder().name("김중딩").grade("중1").classGroup(class1).build(),
            Student.builder().name("이고딩").grade("고1").classGroup(class2).build()
        ));
    }

    private void initChecklistItems() {
        if (checklistItemRepository.count() > 0) return;
        checklistItemRepository.saveAll(List.of(
            ChecklistItem.builder().title("결석 학생 개인 연락").description("결석 학생에게 개인 연락을 해주세요").category("연락").isRequired(true).orderIndex(1).build(),
            ChecklistItem.builder().title("주간 교안 준비").description("다음 주 교안을 미리 준비해주세요").category("준비").isRequired(true).orderIndex(3).build(),
            ChecklistItem.builder().title("특이사항 보고").description("이번 주 특이사항을 임원에게 보고하세요").category("보고").isRequired(true).orderIndex(5).build()
        ));
    }

    private void initEvents() {
        if (eventRepository.count() > 0) return;
        eventRepository.saveAll(List.of(
            Event.builder().title("교사 회의").description("정기 교사 회의").eventDate(LocalDate.now()).eventType(Event.EventType.MEETING).build()
        ));
    }

    private void initEvangelism(List<User> users) {
        List<User> teachers = users.stream()
            .filter(u -> u.getRole() == User.Role.TEACHER)
            .toList();

        EvangelismGroup g1 = evangelismGroupRepository.save(EvangelismGroup.builder().name("1조").build());
        for (User t : teachers) {
            evangelismGroupMemberRepository.save(EvangelismGroupMember.builder().group(g1).teacher(t).build());
        }

        LocalDate nextSat = LocalDate.now().with(TemporalAdjusters.nextOrSame(DayOfWeek.SATURDAY));
        EvangelismSchedule schedule = evangelismScheduleRepository.save(
            EvangelismSchedule.builder().scheduledDate(nextSat).responsibleGroup(g1).build()
        );

        for (User t : teachers) {
            evangelismAssignmentRepository.save(
                EvangelismAssignment.builder().schedule(schedule).teacher(t).group(g1).build()
            );
        }
    }

    private void initMeetingMinutes(List<User> users) {
        LocalDate marchDate = LocalDate.of(2026, 3, 14);
        
        MeetingMinute m1 = meetingMinuteRepository.save(MeetingMinute.builder()
            .title("3월 2주차 정기 교사 회의")
            .content("3월 주요 행사 일정 공유 및 학생 심방 현황 점검\n1. 봄 수련회 준비 위원회 구성\n2. 신입 교사 환영회 일정 확정")
            .videoLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
            .meetingDate(marchDate)
            .isActive(true)
            .build());

        MeetingMinute m2 = meetingMinuteRepository.save(MeetingMinute.builder()
            .title("3월 4주차 기도회 및 회의 (비공개 예시)")
            .content("부활절 준비 관련 기획 회의 내용입니다.\n아직 확정되지 않은 내용이므로 비공개 처리합니다.")
            .meetingDate(LocalDate.of(2026, 3, 28))
            .isActive(false)
            .build());

        // 샘플 출석 데이터 (교사 정미리암은 참석, 고연진은 불참)
        User m1_teacher = users.stream().filter(u -> u.getName().equals("정미리암")).findFirst().orElseThrow();
        User h1_teacher = users.stream().filter(u -> u.getName().equals("고연진")).findFirst().orElseThrow();

        meetingAttendanceRepository.save(MeetingAttendance.builder()
            .teacher(m1_teacher)
            .meetingDate(marchDate)
            .status("ATTEND")
            .build());
            
        meetingAttendanceRepository.save(MeetingAttendance.builder()
            .teacher(h1_teacher)
            .meetingDate(marchDate)
            .status("ABSENT")
            .build());
    }
}
