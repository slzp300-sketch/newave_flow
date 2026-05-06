package com.newaveflow.config;

import com.newaveflow.entity.*;
import com.newaveflow.entity.User.Role;
import com.newaveflow.repository.*;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
@Profile({"dev", "local", "prod"})
public class DataInitService {

    private final UserRepository userRepository;
    private final ClassGroupRepository classGroupRepository;
    private final StudentRepository studentRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final EvangelismGroupRepository evangelismGroupRepository;
    private final EvangelismGroupMemberRepository evangelismGroupMemberRepository;
    private final AttendanceRepository attendanceRepository;
    private final DailyReportRepository dailyReportRepository;
    private final MeetingAttendanceRepository meetingAttendanceRepository;
    private final EventAttendanceRepository eventAttendanceRepository;
    private final MeetingMinuteRepository meetingMinuteRepository;
    private final MeetingMinuteConfirmRepository meetingMinuteConfirmRepository;
    private final PrayerVoteRepository prayerVoteRepository;
    private final EventStudentAttendanceRepository eventStudentAttendanceRepository;
    private final DeactivationRequestRepository deactivationRequestRepository;
    private final StudentMemoRepository studentMemoRepository;
    private final TtsRecordRepository ttsRecordRepository;
    private final TtsQuestionRepository ttsQuestionRepository;
    private final PasswordEncoder passwordEncoder;
    private final RosterDataInitService rosterDataInitService;

    @PostConstruct
    public void init() {
        // 기존 DB의 관리자 이메일 마이그레이션 (slzp300 → admin@naver.com)
        int migrated = userRepository.updateEmailByExactMatch("slzp300", "admin@naver.com");
        if (migrated > 0) log.info("Admin email migrated: slzp300 → admin@naver.com");

        // admin@naver.com 계정이 존재하면 역할을 ADMIN으로 보장
        userRepository.findByEmailIgnoreCase("admin@naver.com").ifPresent(admin -> {
            if (admin.getRole() != Role.ADMIN) {
                admin.updateRole(Role.ADMIN);
                userRepository.save(admin);
                log.info("Admin role ensured: {} → ADMIN", admin.getEmail());
            }
        });

        // IMPORTANT: Only clear and seed if the database is essentially new
        if (userRepository.count() > 0) {
            log.info("Database already initialized. Skipping data seeding.");
            return;
        }

        log.info("Performing a fresh initialization for migration...");
        
        // Clean up any existing loose data just in case
        deactivationRequestRepository.deleteAll();
        studentMemoRepository.deleteAll();
        eventStudentAttendanceRepository.deleteAll();
        eventAttendanceRepository.deleteAll();
        meetingMinuteConfirmRepository.deleteAll();
        prayerVoteRepository.deleteAll();
        teacherClassRepository.deleteAll();
        attendanceRepository.deleteAll();
        dailyReportRepository.deleteAll();
        meetingAttendanceRepository.deleteAll();
        ttsRecordRepository.deleteAll();
        ttsQuestionRepository.deleteAll();
        evangelismGroupMemberRepository.deleteAll();
        evangelismGroupRepository.deleteAll();
        studentRepository.deleteAll();
        classGroupRepository.deleteAll();
        userRepository.deleteAll();

        // 1. Create the primary Admin account
        initAdminUser();
        
        // 2. Load the actual Roster (Classes, Students)
        rosterDataInitService.initRosterData();
        
        log.info("Clean initialization completed. Test data (Attendance, Minutes, etc.) skipped.");
    }

    private void initAdminUser() {
        log.info("Creating primary admin account: admin@naver.com");
        String encodedPassword = passwordEncoder.encode("zd53738445");

        User admin = User.builder()
                .name("최종 관리자")
                .email("admin@naver.com")
                .password(encodedPassword)
                .role(Role.ADMIN)
                .isActive(true)
                .build();

        userRepository.save(admin);
    }
}
