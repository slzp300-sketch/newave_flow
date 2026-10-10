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
@Profile({"dev", "local"})
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true")
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

    @org.springframework.beans.factory.annotation.Value("${BOOTSTRAP_ADMIN_PASSWORD:}")
    private String bootstrapPassword;

    @org.springframework.beans.factory.annotation.Value("${BOOTSTRAP_ADMIN_EMAIL:admin@example.invalid}")
    private String bootstrapEmail;

    @PostConstruct
    public void init() {
        // IMPORTANT: Only clear and seed if the database is essentially new
        if (userRepository.count() > 0) {
            log.info("Database already initialized. Skipping data seeding.");
            return;
        }

        if (bootstrapPassword == null || bootstrapPassword.length() < 12) {
            throw new IllegalStateException("BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters");
        }

        // 1. Create the primary Admin account
        initAdminUser();
        
        // 2. Load the actual Roster (Classes, Students)
        rosterDataInitService.initRosterData();

        // 3. 기본 TTS 항목 (구글 시트 점수 규칙과 동일)
        initTtsQuestions();

        log.info("Clean initialization completed. Test data (Attendance, Minutes, etc.) skipped.");
    }

    private void initTtsQuestions() {
        if (ttsQuestionRepository.count() > 0) return;
        Object[][] defaults = {
                // 제목, 종류, 이모지, 점수, 연동
                {"말씀 (3장 이상)", TtsQuestion.TtsQuestionType.DAYS, "📖", 5, TtsQuestion.TtsLinkType.NONE},
                {"기도 (30분 이상)", TtsQuestion.TtsQuestionType.DAYS, "🙏", 5, TtsQuestion.TtsLinkType.NONE},
                {"교사회의", TtsQuestion.TtsQuestionType.ATTEND, "👥", 10, TtsQuestion.TtsLinkType.SAT_MEETING},
                {"온라인 줌 기도모임", TtsQuestion.TtsQuestionType.ATTEND, "💻", 10, TtsQuestion.TtsLinkType.PRAYER_MEETING},
                {"본예배", TtsQuestion.TtsQuestionType.ATTEND, "⛪", 10, TtsQuestion.TtsLinkType.NONE},
                {"금요철야", TtsQuestion.TtsQuestionType.ATTEND, "🌙", 10, TtsQuestion.TtsLinkType.NONE},
                {"리버스기도회", TtsQuestion.TtsQuestionType.ATTEND, "🔥", 50, TtsQuestion.TtsLinkType.NONE},
        };
        for (int i = 0; i < defaults.length; i++) {
            Object[] d = defaults[i];
            ttsQuestionRepository.save(TtsQuestion.builder()
                    .title((String) d[0])
                    .type((TtsQuestion.TtsQuestionType) d[1])
                    .emoji((String) d[2])
                    .points((Integer) d[3])
                    .linkType((TtsQuestion.TtsLinkType) d[4])
                    .displayOrder(i + 1)
                    .build());
        }
    }

    private void initAdminUser() {
        String encodedPassword = passwordEncoder.encode(bootstrapPassword);

        User admin = User.builder()
                .name("최종 관리자")
                .email(bootstrapEmail)
                .password(encodedPassword)
                .role(Role.ADMIN)
                .isActive(true)
                .build();

        userRepository.save(admin);
    }
}
