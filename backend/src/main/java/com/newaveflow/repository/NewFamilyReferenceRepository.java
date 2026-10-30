package com.newaveflow.repository;
import com.newaveflow.entity.NewFamilyReference;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.*;
public interface NewFamilyReferenceRepository extends JpaRepository<NewFamilyReference,Long> {
    List<NewFamilyReference> findByReportDate(LocalDate date);
    Optional<NewFamilyReference> findByReportDateAndClassIdAndVisitorId(LocalDate date,Long classId,String visitorId);
}
