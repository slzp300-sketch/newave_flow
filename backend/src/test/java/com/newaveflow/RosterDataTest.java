package com.newaveflow;

import com.newaveflow.repository.ClassGroupRepository;
import com.newaveflow.entity.ClassGroup;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(showSql = false)
@ActiveProfiles("test")
public class RosterDataTest {

    @Autowired
    private ClassGroupRepository classGroupRepository;

    @Test
    public void checkData() {
        assertEquals(0, classGroupRepository.count());
        var saved = classGroupRepository.saveAndFlush(ClassGroup.builder().name("검증용 반").ageGroup("검증용 학년").build());
        assertEquals("검증용 반", classGroupRepository.findById(saved.getId()).orElseThrow().getName());
    }
}
