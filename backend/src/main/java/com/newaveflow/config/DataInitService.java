package com.newaveflow.config;

import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;

@Component
@RequiredArgsConstructor
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
    private final PasswordEncoder passwordEncoder;

    @PostConstruct
    public void init() {
        List<User> teachers = initUsers();
        initClasses(teachers);
        initChecklistItems();
        initEvents();
        initEvangelism(teachers);
    }

    private List<User> initUsers() {
        if (userRepository.count() > 0) return userRepository.findAll();

        String pw = passwordEncoder.encode("password123");

        User pastor    = User.builder().name("김목사").email("pastor@church.com").password(pw).role(User.Role.PASTOR).build();
        User executive = User.builder().name("이임원").email("exec@church.com").password(pw).role(User.Role.EXECUTIVE).build();
        User t1 = User.builder().name("박교사").email("teacher1@church.com").password(pw).role(User.Role.TEACHER).build();
        User t2 = User.builder().name("최교사").email("teacher2@church.com").password(pw).role(User.Role.TEACHER).build();
        User t3 = User.builder().name("김교사").email("teacher3@church.com").password(pw).role(User.Role.TEACHER).build();
        User t4 = User.builder().name("이교사").email("teacher4@church.com").password(pw).role(User.Role.TEACHER).build();
        User t5 = User.builder().name("정교사").email("teacher5@church.com").password(pw).role(User.Role.TEACHER).build();
        User t6 = User.builder().name("한교사").email("teacher6@church.com").password(pw).role(User.Role.TEACHER).build();
        User t7 = User.builder().name("이선생").email("teacher7@church.com").password(pw).role(User.Role.TEACHER).build();
        User t8 = User.builder().name("정선생").email("teacher8@church.com").password(pw).role(User.Role.TEACHER).build();

        return userRepository.saveAll(List.of(pastor, executive, t1, t2, t3, t4, t5, t6, t7, t8));
    }

    private void initClasses(List<User> users) {
        if (classGroupRepository.count() > 0) return;

        User t1 = users.stream().filter(u -> u.getEmail().equals("teacher1@church.com")).findFirst().orElseThrow();
        User t2 = users.stream().filter(u -> u.getEmail().equals("teacher2@church.com")).findFirst().orElseThrow();

        ClassGroup class1 = ClassGroup.builder().name("유치부").ageGroup("유치").description("5~7세").build();
        ClassGroup class2 = ClassGroup.builder().name("초등부 1반").ageGroup("초등").description("초등 1~2학년").build();
        ClassGroup class3 = ClassGroup.builder().name("초등부 2반").ageGroup("초등").description("초등 3~4학년").build();
        ClassGroup class4 = ClassGroup.builder().name("중등부").ageGroup("중등").description("중학생").build();

        classGroupRepository.saveAll(List.of(class1, class2, class3, class4));

        teacherClassRepository.save(TeacherClass.builder().teacher(t1).classGroup(class1).build());
        teacherClassRepository.save(TeacherClass.builder().teacher(t2).classGroup(class2).build());

        studentRepository.saveAll(List.of(
            Student.builder().name("김민준").grade("7세").parentName("김철수").parentPhone("010-1111-1111").classGroup(class1).build(),
            Student.builder().name("이서연").grade("6세").parentName("이영희").parentPhone("010-2222-2222").classGroup(class1).build(),
            Student.builder().name("박지호").grade("5세").parentName("박준혁").parentPhone("010-3333-3333").classGroup(class1).build(),
            Student.builder().name("강하늘").grade("초2").parentName("강민호").parentPhone("010-8888-8888").classGroup(class2).build(),
            Student.builder().name("윤지수").grade("초1").parentName("윤세진").parentPhone("010-9999-9999").classGroup(class2).build()
        ));
    }

    private void initChecklistItems() {
        if (checklistItemRepository.count() > 0) return;

        checklistItemRepository.saveAll(List.of(
            ChecklistItem.builder().title("결석 학생 개인 연락").description("결석 학생에게 개인 연락을 해주세요").category("연락").isRequired(true).orderIndex(1).build(),
            ChecklistItem.builder().title("부모님 연락 (필요 시)").description("특이사항이 있는 학생의 부모님께 연락").category("연락").isRequired(false).orderIndex(2).build(),
            ChecklistItem.builder().title("주간 교안 준비").description("다음 주 교안을 미리 준비해주세요").category("준비").isRequired(true).orderIndex(3).build(),
            ChecklistItem.builder().title("교실 정리정돈").description("예배 후 교실을 깨끗이 정리해주세요").category("환경").isRequired(false).orderIndex(4).build(),
            ChecklistItem.builder().title("특이사항 보고").description("이번 주 특이사항을 임원에게 보고하세요").category("보고").isRequired(true).orderIndex(5).build()
        ));
    }

    private void initEvents() {
        if (eventRepository.count() > 0) return;

        eventRepository.saveAll(List.of(
            Event.builder().title("여름 성경학교").description("전 부서 연합 행사").eventDate(LocalDate.now().plusMonths(1)).eventType(Event.EventType.SPECIAL).build(),
            Event.builder().title("교사 회의").description("월례 교사 회의").eventDate(LocalDate.now()).eventType(Event.EventType.MEETING).build(),
            Event.builder().title("월례 예배").description("정기 월례 예배").eventDate(LocalDate.now().plusDays(15)).eventType(Event.EventType.REGULAR).build()
        ));
    }

    private void initEvangelism(List<User> users) {
        if (evangelismGroupRepository.count() > 0) return;

        List<User> teachers = users.stream()
            .filter(u -> u.getRole() == User.Role.TEACHER)
            .toList();

        // 5개 조 생성
        EvangelismGroup g1 = evangelismGroupRepository.save(EvangelismGroup.builder().name("1조").build());
        EvangelismGroup g2 = evangelismGroupRepository.save(EvangelismGroup.builder().name("2조").build());
        EvangelismGroup g3 = evangelismGroupRepository.save(EvangelismGroup.builder().name("3조").build());
        EvangelismGroup g4 = evangelismGroupRepository.save(EvangelismGroup.builder().name("4조").build());
        EvangelismGroup g5 = evangelismGroupRepository.save(EvangelismGroup.builder().name("5조").build());

        // 교사를 조에 배정 (조 인원수를 다르게)
        assignMember(teachers, 0, g1);
        assignMember(teachers, 1, g1);
        assignMember(teachers, 2, g2);
        assignMember(teachers, 3, g3);
        assignMember(teachers, 4, g4);
        assignMember(teachers, 5, g5);

        // 향후 토요일 6개에 일정 등록
        LocalDate nextSat = LocalDate.now().with(TemporalAdjusters.nextOrSame(DayOfWeek.SATURDAY));
        List<EvangelismGroup> groups = List.of(g1, g2, g3, g4, g5, g1);

        for (int i = 0; i < 6; i++) {
            LocalDate date = nextSat.plusWeeks(i);
            EvangelismGroup group = groups.get(i);

            EvangelismSchedule schedule = evangelismScheduleRepository.save(
                EvangelismSchedule.builder()
                    .scheduledDate(date)
                    .build()
            );

            // 해당 조의 첫 번째 교사를 담당자로 배정
            group.getMembers().stream().findFirst().ifPresent(member ->
                evangelismAssignmentRepository.save(
                    EvangelismAssignment.builder()
                        .schedule(schedule)
                        .teacher(member.getTeacher())
                        .group(group)
                        .build()
                )
            );
        }
    }

    private void assignMember(List<User> teachers, int index, EvangelismGroup group) {
        if (index >= teachers.size()) return;
        evangelismGroupMemberRepository.save(
            EvangelismGroupMember.builder()
                .group(group)
                .teacher(teachers.get(index))
                .build()
        );
    }
}
