package com.newaveflow.repository;

import com.newaveflow.entity.KakaoAuthFlow;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.Optional;

public interface KakaoAuthFlowRepository extends JpaRepository<KakaoAuthFlow, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from KakaoAuthFlow f where f.id = :id")
    Optional<KakaoAuthFlow> lockById(@Param("id") String id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from KakaoAuthFlow f where f.stateHash = :hash")
    Optional<KakaoAuthFlow> lockByStateHash(@Param("hash") String hash);
    @Modifying @Query("delete from KakaoAuthFlow f where f.expiresAt < :now")
    void deleteExpired(@Param("now") Instant now);
    @Modifying @Query("delete from KakaoAuthFlow f where f.kakaoId = :kakaoId")
    void deleteForKakaoId(@Param("kakaoId") String kakaoId);
}
