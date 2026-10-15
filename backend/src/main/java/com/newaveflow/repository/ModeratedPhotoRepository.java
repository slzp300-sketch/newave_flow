package com.newaveflow.repository;
import com.newaveflow.entity.ModeratedPhoto;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
public interface ModeratedPhotoRepository extends JpaRepository<ModeratedPhoto,Long> {
    Optional<ModeratedPhoto> findByTargetTypeAndTargetId(ModeratedPhoto.TargetType type,Long targetId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from ModeratedPhoto p where p.targetType=:type and p.targetId=:targetId")
    Optional<ModeratedPhoto> lockTarget(@Param("type") ModeratedPhoto.TargetType type,@Param("targetId") Long targetId);
    Page<ModeratedPhoto> findByStatus(ModeratedPhoto.Status status,Pageable pageable);
    long countByStatus(ModeratedPhoto.Status status);
}
