package com.newaveflow.service;

import com.newaveflow.dto.UserApprovalRequest;
import com.newaveflow.dto.auth.LoginResponse.UserInfo;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class AdminUserService {
    private final UserRepository userRepository;
    private final ClassGroupRepository classGroupRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final UserStatusEventRepository statusEvents;
    private final AccountDeletionRequestRepository deletions;
    private final jakarta.persistence.EntityManager entityManager;
    private record ActorIdentity(Long id, long authVersion) {}

    public record SuspendedUser(UserInfo user, LocalDateTime suspendedAt, long authVersion, String reason) {}
    public record StatusHistory(Long id, String action, String reason, String actorName,
                                Long reportId, LocalDateTime createdAt) {}

    public List<UserInfo> getPendingUsers() {
        return userRepository.findByIsActiveFalseAndIsSuspendedFalse().stream()
            .filter(u -> u.getRole() == User.Role.TEACHER)
            .map(u -> UserInfo.from(u, u.getGrade())).toList();
    }

    public List<SuspendedUser> getSuspendedUsers() {
        return userRepository.findByIsSuspendedTrueOrderBySuspendedAtDescIdDesc().stream().map(u -> {
            var history = statusEvents.findTop100ByUserIdOrderByCreatedAtDescIdDesc(u.getId());
            String reason = history.isEmpty() ? "이전 정지 사유를 확인해주세요." : history.get(0).getReason();
            return new SuspendedUser(UserInfo.from(u, u.getGrade()), u.getSuspendedAt(), u.getAuthVersion(), reason);
        }).toList();
    }

    public List<StatusHistory> statusHistory(Long userId) {
        if (!userRepository.existsById(userId)) throw AppException.notFound("사용자를 찾을 수 없습니다.");
        return statusEvents.findTop100ByUserIdOrderByCreatedAtDescIdDesc(userId).stream().map(e ->
            new StatusHistory(e.getId(), e.getAction().name(), e.getReason(),
                e.getActorId() == null ? "이전 기록 또는 삭제된 계정" : userRepository.findById(e.getActorId()).map(User::getName).orElse("삭제된 계정"),
                e.getReportId(), e.getCreatedAt())).toList();
    }

    @Transactional
    public void approveUser(User actor, Long userId, UserApprovalRequest request) {
        var identity = identity(actor);
        var locked = lockAccounts();
        requireActor(locked, identity, false);
        User user = target(locked, userId);
        if (user.isSuspended()) throw AppException.conflict("이용 정지 계정은 가입 승인으로 복구할 수 없습니다. 이용 정지 목록에서 복구해주세요.");
        if (user.isActive()) throw AppException.conflict("이미 승인된 계정입니다.");
        if (user.getRole() != User.Role.TEACHER) throw AppException.conflict("일반 교사 신규 가입만 승인할 수 있습니다. 기존 계정 상태를 확인해주세요.");
        if (deletions.existsByUserId(userId)) throw AppException.conflict("계정 삭제 요청이 진행 중입니다.");
        if (request != null && request.getClassGroupId() != null) {
            ClassGroup group = classGroupRepository.findById(request.getClassGroupId())
                .orElseThrow(() -> AppException.notFound("반을 찾을 수 없습니다."));
            teacherClassRepository.save(TeacherClass.builder().teacher(user).classGroup(group).isPrimary(true).build());
        }
        user.approve();
    }

    /** Called from the same transaction as a report resolution. */
    @Transactional
    public void suspendUser(User actor, Long userId, String reason, Long reportId) {
        String note = requireReason(reason);
        var identity = identity(actor);
        var locked = lockAccounts();
        User currentActor = requireActor(locked, identity, false);
        User user = target(locked, userId);
        if (user.getId().equals(currentActor.getId()) ||
            ((user.getRole() == User.Role.ADMIN || user.getRole() == User.Role.PASTOR) && currentActor.getRole() != User.Role.ADMIN))
            throw AppException.forbidden("본인 계정은 제한할 수 없으며 관리자·목사 계정 제한은 최종 관리자만 가능합니다.");
        if (!user.isActive() || user.isSuspended()) throw AppException.conflict("이미 이용이 제한됐거나 승인 대기 중인 계정입니다.");
        requireAnotherAdmin(locked, user);
        user.suspend();
        record(user, currentActor, UserStatusEvent.Action.SUSPEND, note, reportId);
    }

    @Transactional
    public void restoreUser(User actor, Long userId, String reason, long expectedAuthVersion) {
        String note = requireReason(reason);
        var identity = identity(actor);
        var locked = lockAccounts();
        User currentActor = requireActor(locked, identity, true);
        User user = target(locked, userId);
        if (user.getId().equals(currentActor.getId())) throw AppException.forbidden("본인 계정은 직접 복구할 수 없습니다.");
        if (!user.isSuspended() || user.isActive()) throw AppException.conflict("현재 이용 정지 상태가 아닙니다. 목록을 새로고침해주세요.");
        if (user.getAuthVersion() != expectedAuthVersion) throw AppException.conflict("계정 상태가 변경되었습니다. 목록을 새로고침한 뒤 다시 확인해주세요.");
        if (deletions.existsByUserId(userId)) throw AppException.conflict("계정 삭제 요청이 진행 중이므로 복구할 수 없습니다.");
        if (user.getRole() == User.Role.ADMIN || user.getRole() == User.Role.PASTOR) {
            long count = locked.stream().filter(User::isActive).filter(u -> u.getRole() == User.Role.ADMIN || u.getRole() == User.Role.PASTOR).count();
            if (count >= 2) throw AppException.conflict("최종관리자 및 목사님 권한은 최대 2명입니다. 권한 구성을 먼저 확인해주세요.");
        }
        user.restore();
        record(user, currentActor, UserStatusEvent.Action.RESTORE, note, null);
    }

    @Transactional
    public void updateRole(User actor, Long userId, User.Role newRole) {
        var identity = identity(actor);
        var locked = lockAccounts();
        User currentActor = requireActor(locked, identity, false);
        User user = target(locked, userId);
        if (!user.isActive() || user.isSuspended()) throw AppException.conflict("이용 중인 계정만 권한을 변경할 수 있습니다.");
        if (currentActor.getRole() != User.Role.ADMIN && (newRole == User.Role.ADMIN || user.getRole() == User.Role.ADMIN))
            throw AppException.forbidden("최종관리자 권한은 최종관리자만 변경할 수 있습니다.");
        if (user.getRole() == User.Role.ADMIN && newRole != User.Role.ADMIN) requireAnotherAdmin(locked, user);
        if (newRole == User.Role.ADMIN || newRole == User.Role.PASTOR) {
            long count = locked.stream().filter(User::isActive).filter(u -> u.getRole() == User.Role.ADMIN || u.getRole() == User.Role.PASTOR).count();
            if (user.getRole() != User.Role.ADMIN && user.getRole() != User.Role.PASTOR && count >= 2)
                throw AppException.badRequest("최종관리자 및 목사님 권한은 최대 2명까지만 설정할 수 있습니다.");
        }
        user.updateRole(newRole);
    }

    private ActorIdentity identity(User actor) {
        if (actor == null) throw AppException.unauthorized("로그인이 필요합니다.");
        return new ActorIdentity(actor.getId(), actor.getAuthVersion());
    }
    private List<User> lockAccounts() {
        var locked = userRepository.lockAllForStatusChange();
        // The request's authentication principal may already be managed by the OSIV
        // persistence context. Reload after acquiring locks so a waiting request cannot
        // use its pre-suspension/pre-demotion entity snapshot.
        locked.forEach(user -> entityManager.refresh(user, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE));
        return locked;
    }
    private User requireActor(List<User> locked, ActorIdentity actor, boolean adminOnly) {
        User current = target(locked, actor.id());
        if (!current.isActive() || current.isSuspended() || current.getAuthVersion() != actor.authVersion())
            throw AppException.unauthorized("계정 상태가 변경되었습니다. 다시 로그인해주세요.");
        if (current.getRole() == User.Role.TEACHER || (adminOnly && current.getRole() != User.Role.ADMIN))
            throw AppException.forbidden(adminOnly ? "최종 관리자만 이용 정지를 해제할 수 있습니다." : "관리자만 계정을 관리할 수 있습니다.");
        return current;
    }
    private User target(List<User> locked, Long userId) {
        return locked.stream().filter(u -> u.getId().equals(userId)).findFirst().orElseThrow(() -> AppException.notFound("사용자를 찾을 수 없습니다."));
    }
    private void requireAnotherAdmin(List<User> locked, User user) {
        if (user.getRole() == User.Role.ADMIN && locked.stream().noneMatch(u -> !u.getId().equals(user.getId()) && u.isActive() && u.getRole() == User.Role.ADMIN))
            throw AppException.conflict("마지막 최종관리자 계정은 제한하거나 권한을 낮출 수 없습니다.");
    }
    private String requireReason(String reason) {
        if (reason == null || reason.isBlank() || reason.trim().length() > 2000)
            throw AppException.badRequest("조치 사유를 1~2,000자로 입력해주세요.");
        return reason.trim();
    }
    private void record(User user, User actor, UserStatusEvent.Action action, String reason, Long reportId) {
        statusEvents.save(UserStatusEvent.builder().userId(user.getId()).actorId(actor.getId()).action(action).reason(reason).reportId(reportId).build());
    }
}
