package com.newaveflow.config;

import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.service.EventRosterService;
import java.time.*;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Contains invented records only. Never calls RosterDataInitService. */
@Component @Profile("review") @RequiredArgsConstructor
public class ReviewFixtures implements ApplicationRunner {
    public static final String TEACHER_EMAIL = "play.teacher@review.newaveflow.invalid";
    public static final String ADMIN_EMAIL = "play.admin@review.newaveflow.invalid";
    private final UserRepository users;
    private final ClassGroupRepository classes;
    private final StudentRepository students;
    private final TeacherClassRepository assignments;
    private final TtsQuestionRepository questions;
    private final AttendanceRepository attendance;
    private final DailyReportRepository reports;
    private final MeetingMinuteRepository minutes;
    private final EventRepository events;
    private final EventRosterService eventRoster;
    private final PasswordEncoder passwords;
    private final PlatformTransactionManager transactions;
    @Value("${app.review.teacher-password}") private String teacherPassword;
    @Value("${app.review.admin-password}") private String adminPassword;

    @Override public void run(ApplicationArguments args) { refresh(); }
    @Scheduled(cron = "0 5 0 * * *", zone = "Asia/Seoul")
    public void refresh() {
        new TransactionTemplate(transactions).executeWithoutResult(status -> initialize());
    }

    private void initialize() {
        boolean first = users.count() == 0;
        User teacher = account(TEACHER_EMAIL, "가상 교사", User.Role.TEACHER, teacherPassword);
        account(ADMIN_EMAIL, "가상 관리자", User.Role.ADMIN, adminPassword);
        if (first) {
            User colleague = account("play.colleague@review.newaveflow.invalid", "가상 동료교사", User.Role.TEACHER, teacherPassword);
            users.save(User.builder().name("가상 승인대기 교사").email("pending@review.newaveflow.invalid")
                    .password(passwords.encode(java.util.UUID.randomUUID().toString())).role(User.Role.TEACHER).isActive(false).build());
            ClassGroup primary = classes.save(ClassGroup.builder().name("가상 1반").ageGroup("고1").gender("남").description("심사용 가상 반").build());
            ClassGroup other = classes.save(ClassGroup.builder().name("가상 2반").ageGroup("고2").gender("여").description("심사용 가상 반").build());
            assignments.save(TeacherClass.builder().teacher(teacher).classGroup(primary).isPrimary(true).build());
            assignments.save(TeacherClass.builder().teacher(colleague).classGroup(primary).isPrimary(false).build());
            LocalDate sunday = LocalDate.now(ZoneId.of("Asia/Seoul")).with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
            for (int i = 1; i <= 8; i++) {
                ClassGroup group = i <= 4 ? primary : other;
                Student student = students.save(Student.builder().name(String.format("가상학생%02d", i)).classGroup(group)
                        .grade(i <= 4 ? "고1" : "고2").gender(i <= 4 ? "남" : "여")
                        .school("가상학교").birthDate(LocalDate.of(2009, 1, i)).address("심사용 가상 주소")
                        .fatherName("가상 보호자").motherName("가상 보호자").baptism(false).build());
                if (i <= 4) attendance.save(Attendance.builder().student(student).classGroup(group).teacher(teacher)
                        .attendanceDate(sunday.minusWeeks(1)).status(i == 4 ? Attendance.Status.ABSENT : Attendance.Status.PRESENT)
                        .absentReason(i == 4 ? "가상 출결 예시" : null).build());
            }
            reports.save(DailyReport.builder().classGroup(primary).teacher(teacher).reportDate(sunday.minusWeeks(1))
                    .status(DailyReport.Status.SUBMITTED).totalStudents(4).presentCount(3).absentCount(1)
                    .specialNotes("실제 학생 정보가 없는 가상 보고서입니다.").submittedAt(LocalDateTime.now()).build());
            minutes.save(MeetingMinute.builder().title("가상 교사회의 안내").meetingDate(sunday.minusDays(1))
                    .content("심사용 예시 회의록입니다. 가상 반의 출석과 다음 행사를 함께 확인했습니다.").build());
            seedQuestions();
        }
        accessibleEvent("[심사예시] 참여 확인 행사", 2, true);
        accessibleEvent("[심사예시] 교사 일정", 5, false);
    }

    private User account(String email, String name, User.Role role, String password) {
        User user = users.findByEmailIgnoreCase(email).orElseGet(() -> User.builder().email(email).name(name)
                .role(role).password(passwords.encode(password)).isActive(true).build());
        if (!passwords.matches(password, user.getPassword())) user.updatePassword(passwords.encode(password));
        user.updateRole(role);
        user.approve();
        return users.save(user);
    }

    private void seedQuestions() {
        if (questions.count() > 0) return;
        String[] titles = {"말씀 (3장 이상)", "기도 (30분 이상)", "교사회의", "온라인 줌 기도모임", "본예배", "금요철야", "리버스기도회"};
        String[] emoji = {"📖", "🙏", "👥", "💻", "⛪", "🌙", "🔥"};
        for (int i = 0; i < titles.length; i++) questions.save(TtsQuestion.builder().title(titles[i]).emoji(emoji[i])
                .type(i < 2 ? TtsQuestion.TtsQuestionType.DAYS : TtsQuestion.TtsQuestionType.ATTEND)
                .points(i < 2 ? 5 : i == 6 ? 50 : 10).linkType(TtsQuestion.TtsLinkType.NONE).displayOrder(i + 1).build());
    }

    private void accessibleEvent(String title, int offset, boolean checked) {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        Event event = events.findAll().stream().filter(e -> title.equals(e.getTitle())).findFirst()
                .orElseGet(() -> Event.builder().title(title).eventType(checked ? Event.EventType.SPECIAL : Event.EventType.MEETING)
                        .description("실제 행사가 아닌 심사용 가상 일정입니다.").attendanceRequired(checked)
                        .attendanceTarget(Event.AttendanceTarget.BOTH).color("#3b82f6").eventDate(today).build());
        event.setEventDate(today.plusDays(offset));
        event.setEndDate(today.plusDays(offset + 1));
        event.setAttendanceStartDate(today.minusDays(7));
        event.setAttendanceDeadline(today.plusDays(30));
        events.save(event);
        eventRoster.capture(event);
    }
}
