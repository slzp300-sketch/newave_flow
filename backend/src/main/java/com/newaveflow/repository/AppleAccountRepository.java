package com.newaveflow.repository;

import com.newaveflow.entity.AppleAccount;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface AppleAccountRepository extends JpaRepository<AppleAccount, Long> {
    Optional<AppleAccount> findBySubject(String subject);
    @Query("select a.userId from AppleAccount a where a.subject = :subject")
    Optional<Long> findUserIdBySubject(@Param("subject") String subject);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from AppleAccount a where a.userId = :id")
    Optional<AppleAccount> lockByUserId(@Param("id") Long id);
}
