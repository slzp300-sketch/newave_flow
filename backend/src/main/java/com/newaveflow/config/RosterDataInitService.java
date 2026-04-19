package com.newaveflow.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class RosterDataInitService {

    private final ClassGroupRepository classGroupRepository;
    private final StudentRepository studentRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;

    @Transactional
    public void initRosterData() {
        log.info("Initializing roster data from JSON...");
        
        // Clean up is handled by DataInitService before calling this, 
        // but we ensure it here too for safety.
        studentRepository.deleteAll();
        teacherClassRepository.deleteAll();
        classGroupRepository.deleteAll();

        try {
            InputStream is = new ClassPathResource("roster_data.json").getInputStream();
            Map<String, List<ClassJson>> rosterData = objectMapper.readValue(is, new TypeReference<>() {});
            System.out.println("Loaded " + rosterData.size() + " grades from JSON.");

            String defaultPassword = passwordEncoder.encode("password123");
            Map<String, User> teacherMap = new HashMap<>();

            for (Map.Entry<String, List<ClassJson>> entry : rosterData.entrySet()) {
                String grade = entry.getKey();
                List<ClassJson> classes = entry.getValue();

                for (ClassJson classJson : classes) {
                    // 1. Create ClassGroup
                    ClassGroup classGroup = ClassGroup.builder()
                            .name(classJson.name())
                            .ageGroup(grade)
                            .gender(classJson.gender())
                            .description(grade + " " + classJson.name())
                            .build();
                    classGroup = classGroupRepository.save(classGroup);

                    // 2. Create/Get Teacher
                    if (classJson.teacherName() != null && !classJson.teacherName().isEmpty()) {
                        User teacher = teacherMap.get(classJson.teacherName());
                        if (teacher == null) {
                            // First, try to find by name (to match users created in DataInitService)
                            teacher = userRepository.findByName(classJson.teacherName()).orElse(null);
                            
                            if (teacher == null) {
                                String email = "teacher_" + classJson.teacherName() + "@church.com";
                                teacher = userRepository.findByEmail(email).orElse(null);
                                if (teacher == null) {
                                    teacher = User.builder()
                                            .name(classJson.teacherName())
                                            .email(email)
                                            .password(defaultPassword)
                                            .role(User.Role.TEACHER)
                                            .grade(grade)
                                            .build();
                                    teacher = userRepository.save(teacher);
                                }
                            }
                            teacherMap.put(classJson.teacherName(), teacher);
                        }

                        // 3. Link Teacher to Class
                        teacherClassRepository.save(TeacherClass.builder()
                                .teacher(teacher)
                                .classGroup(classGroup)
                                .isPrimary(true)
                                .build());
                    }

                    // 4. Create Students
                    for (StudentJson studentJson : classJson.students()) {
                        String[] names = splitParentNames(studentJson.parent());
                        String[] phones = splitParentPhones(studentJson.parentPhone());

                        Student student = Student.builder()
                                .name(studentJson.name())
                                .gender(studentJson.gender())
                                .birthDate(parseDate(studentJson.birth()))
                                .school(studentJson.school())
                                .phone(studentJson.phone())
                                .baptism(studentJson.baptism())
                                .fatherName(names[0])
                                .motherName(names[1])
                                .fatherPhone(phones[0])
                                .motherPhone(phones[1])
                                .address(studentJson.address())
                                .classGroup(classGroup)
                                .grade(grade)
                                .isActive(true)
                                .build();
                        studentRepository.save(student);
                    }
                }
            }
            log.info("Roster data initialization completed.");
        } catch (Exception e) {
            log.error("Failed to initialize roster data", e);
        }
    }

    private String[] splitParentNames(String parent) {
        if (parent == null || parent.isEmpty()) return new String[]{null, null};
        String[] parts = parent.split("/");
        if (parts.length >= 2) return new String[]{parts[0].trim(), parts[1].trim()};
        return new String[]{parts[0].trim(), null};
    }

    private String[] splitParentPhones(String phone) {
        if (phone == null || phone.isEmpty()) return new String[]{null, null};
        String[] parts = phone.split(",");
        if (parts.length >= 2) return new String[]{parts[0].trim(), parts[1].trim()};
        return new String[]{parts[0].trim(), null};
    }

    private LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isEmpty()) return null;
        try {
            // Some dates might be just year "2010"
            if (dateStr.length() == 4) {
                return LocalDate.of(Integer.parseInt(dateStr), 1, 1);
            }
            return LocalDate.parse(dateStr);
        } catch (Exception e) {
            log.warn("Failed to parse date: {}", dateStr);
            return null;
        }
    }

    private record ClassJson(String id, String name, String gender, String teacherName, List<StudentJson> students) {}
    private record StudentJson(String id, String name, String gender, String birth, String school, String phone, Boolean baptism, String parent, String parentPhone, String address) {}
}
