package com.newaveflow.service;

import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import java.io.ByteArrayInputStream;
import java.time.LocalDateTime;
import java.util.*;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class PhotoModerationService {
    private final ModeratedPhotoRepository photos;
    private final UserRepository users;
    private final StudentRepository students;
    private final ClassAccessService access;
    private final jakarta.persistence.EntityManager entityManager;
    public record PhotoView(Long id,long revision,ModeratedPhoto.TargetType targetType,Long targetId,String targetName,
        ModeratedPhoto.Status status,LocalDateTime submittedAt,LocalDateTime reviewedAt,String reviewNote) {}
    public record ReviewRequest(@NotNull ModeratedPhoto.Status decision,@NotNull @PositiveOrZero Long expectedRevision,
        @NotBlank @Size(max=2000) String note) {}
    private PhotoView view(ModeratedPhoto photo) {
        String name=photo.getTargetType()==ModeratedPhoto.TargetType.USER
            ? users.findById(photo.getTargetId()).map(User::getName).orElse("삭제된 계정")
            : students.findById(photo.getTargetId()).map(Student::getName).orElse("삭제된 학생");
        return new PhotoView(photo.getId(),photo.getRevision(),photo.getTargetType(),photo.getTargetId(),name,
            photo.getStatus(),photo.getSubmittedAt(),photo.getReviewedAt(),photo.getReviewNote());
    }
    private void moderator(User actor) {
        if(!CommunitySafetyService.isModerator(actor)) throw AppException.forbidden("관리자만 사진을 검토할 수 있습니다.");
    }
    private String lockTarget(ModeratedPhoto.TargetType type,Long id) {
        if(type==ModeratedPhoto.TargetType.USER) return users.lockById(id)
            .orElseThrow(()->AppException.notFound("사용자를 찾을 수 없습니다.")).getProfileImage();
        return students.lockById(id).orElseThrow(()->AppException.notFound("학생을 찾을 수 없습니다.")).getProfileImage();
    }
    private void checkAccess(User actor,ModeratedPhoto.TargetType type,Long id) {
        if(type==ModeratedPhoto.TargetType.USER) {
            if(!Objects.equals(actor.getId(),id)) throw AppException.forbidden("본인 사진만 변경할 수 있습니다.");
            if(!users.existsById(id)) throw AppException.notFound("사용자를 찾을 수 없습니다.");
        } else access.requireStudent(actor,students.findById(id).orElseThrow(()->AppException.notFound("학생을 찾을 수 없습니다.")));
    }
    private static String emptyToNull(String value) { return value==null||value.isBlank()?null:value; }
    /** Called with the target row locked; writes only a candidate and returns the still-approved picture. */
    @Transactional public String submit(ModeratedPhoto.TargetType type,Long id,String current,String incoming,Long actorId) {
        current=emptyToNull(current); incoming=emptyToNull(incoming);
        if(Objects.equals(current,incoming)) return current; // Old clients resubmit the visible picture.
        var existing=photos.lockTarget(type,id).orElse(null);
        if(incoming==null) {
            if(existing!=null) existing.resolve(ModeratedPhoto.Status.HIDDEN,actorId,"작성자가 사진을 삭제했습니다.");
            return null;
        }
        validateImage(incoming);
        if(existing!=null && existing.getStatus()==ModeratedPhoto.Status.PENDING && incoming.equals(existing.getPendingImage())) return current;
        if(existing==null) existing=ModeratedPhoto.builder().targetType(type).targetId(id).build();
        existing.submit(incoming,actorId); photos.save(existing);
        return current;
    }
    static void validateImage(String image) {
        if(image.length()>2_800_000) throw AppException.badRequest("사진은 2MB 이하 PNG 또는 JPEG 파일을 선택해주세요.");
        int comma=image.indexOf(',');
        if(comma<0 || !(image.startsWith("data:image/png;base64,")||image.startsWith("data:image/jpeg;base64,")))
            throw AppException.badRequest("사진은 PNG 또는 JPEG 파일만 사용할 수 있습니다.");
        ImageReader reader=null;
        try {
            byte[] bytes=Base64.getDecoder().decode(image.substring(comma+1));
            if(bytes.length==0||bytes.length>2*1024*1024) throw new IllegalArgumentException();
            try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers=ImageIO.getImageReaders(stream);
                if(!readers.hasNext()) throw new IllegalArgumentException();
                reader=readers.next(); reader.setInput(stream,true,true);
                String expected=image.startsWith("data:image/png;")?"png":"jpeg";
                if(!reader.getFormatName().equalsIgnoreCase(expected)) throw new IllegalArgumentException();
                int w=reader.getWidth(0),h=reader.getHeight(0);
                if(w<1||h<1||w>4096||h>4096||((long)w*h)>16_000_000) throw new IllegalArgumentException();
                if(reader.read(0)==null) throw new IllegalArgumentException();
            }
        } catch(Exception e) { throw AppException.badRequest("사진 파일을 확인해주세요. PNG/JPEG, 2MB 이하, 가로·세로 4096픽셀 이하만 사용할 수 있습니다."); }
        finally { if(reader!=null) reader.dispose(); }
    }
    public PhotoView status(User actor,ModeratedPhoto.TargetType type,Long id) {
        checkAccess(actor,type,id); return photos.findByTargetTypeAndTargetId(type,id).map(this::view).orElse(null);
    }
    public Page<PhotoView> list(User actor,ModeratedPhoto.Status status,int page) {
        moderator(actor); if(page<0||page>10000) throw AppException.badRequest("페이지 번호가 올바르지 않습니다.");
        var pageable=PageRequest.of(page,20,Sort.by("submittedAt","id"));
        return (status==null?photos.findAll(pageable):photos.findByStatus(status,pageable)).map(this::view);
    }
    public Map<String,Object> image(User actor,Long id) {
        moderator(actor); var photo=photos.findById(id).orElseThrow(()->AppException.notFound("사진을 찾을 수 없습니다."));
        if(photo.getStatus()!=ModeratedPhoto.Status.PENDING||photo.getPendingImage()==null) throw AppException.notFound("검토 대기 사진이 없습니다.");
        return Map.of("image",photo.getPendingImage(),"revision",photo.getRevision());
    }
    @Transactional public PhotoView review(User actor,Long id,ReviewRequest request) {
        moderator(actor);
        if(request.decision()!=ModeratedPhoto.Status.APPROVED&&request.decision()!=ModeratedPhoto.Status.REJECTED)
            throw AppException.badRequest("승인 또는 거절을 선택해주세요.");
        var reference=photos.findById(id).orElseThrow(()->AppException.notFound("사진을 찾을 수 없습니다."));
        lockTarget(reference.getTargetType(),reference.getTargetId());
        entityManager.refresh(reference,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        var photo=photos.lockTarget(reference.getTargetType(),reference.getTargetId()).orElseThrow();
        if(photo.getRevision()!=request.expectedRevision()||photo.getStatus()!=ModeratedPhoto.Status.PENDING)
            throw AppException.conflict("사진이 변경되었거나 이미 처리되었습니다. 다시 확인해주세요.");
        if(request.decision()==ModeratedPhoto.Status.APPROVED) setApproved(photo.getTargetType(),photo.getTargetId(),photo.getPendingImage());
        photo.resolve(request.decision(),actor.getId(),request.note().trim()); photos.flush(); return view(photo);
    }
    private void setApproved(ModeratedPhoto.TargetType type,Long id,String image) {
        if(type==ModeratedPhoto.TargetType.USER) {
            var user=users.findById(id).orElseThrow();
            user.updateProfile(user.getName(),user.getPhone(),user.getBirthDate(),image,user.getChurchPosition());
        } else students.findById(id).orElseThrow().setProfileImage(image);
    }
    @Transactional public void remove(User actor,ModeratedPhoto.TargetType type,Long id) {
        checkAccess(actor,type,id); hide(actor,type,id,"작성자가 사진을 삭제했습니다.");
    }
    @Transactional public void hide(User actor,ModeratedPhoto.TargetType type,Long id,String note) {
        lockTarget(type,id); setApproved(type,id,null);
        photos.lockTarget(type,id).ifPresent(photo->photo.resolve(ModeratedPhoto.Status.HIDDEN,actor.getId(),note));
    }
    public long pendingCount() { return photos.countByStatus(ModeratedPhoto.Status.PENDING); }
}
