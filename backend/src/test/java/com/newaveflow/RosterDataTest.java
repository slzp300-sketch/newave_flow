package com.newaveflow;

import com.newaveflow.repository.ClassGroupRepository;
import com.newaveflow.repository.StudentRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
public class RosterDataTest {

    @Autowired
    private ClassGroupRepository classGroupRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Test
    public void checkData() {
        System.out.println("ClassGroup count: " + classGroupRepository.count());
        System.out.println("Student count: " + studentRepository.count());
        classGroupRepository.findAll().forEach(c -> {
            System.out.println("Class: " + c.getName() + ", AgeGroup: " + c.getAgeGroup());
        });
    }
}
