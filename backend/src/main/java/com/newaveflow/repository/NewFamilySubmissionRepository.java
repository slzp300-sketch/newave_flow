package com.newaveflow.repository;
import com.newaveflow.entity.NewFamilySubmission;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
public interface NewFamilySubmissionRepository extends JpaRepository<NewFamilySubmission,LocalDate> {}
