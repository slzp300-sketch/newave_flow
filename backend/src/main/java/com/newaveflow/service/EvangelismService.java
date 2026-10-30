package com.newaveflow.service;

import com.newaveflow.dto.evangelism.EvangelismDto.*;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EvangelismService {

    private final EvangelismGroupRepository groupRepo;
    private final EvangelismGroupMemberRepository memberRepo;
    private final EvangelismScheduleRepository scheduleRepo;
    private final EvangelismAssignmentRepository assignmentRepo;
    private final UserRepository userRepo;

    public List<GroupResponse> getAllGroups() {
        return groupRepo.findAllActiveWithMembers().stream()
            .map(GroupResponse::from)
            .toList();
    }

    @Transactional
    public GroupResponse createGroup(GroupRequest req) {
        EvangelismGroup group = EvangelismGroup.builder()
            .name(req.name())
            .build();
        return GroupResponse.from(groupRepo.save(group));
    }

    @Transactional
    public GroupResponse updateGroup(Long groupId, GroupRequest req) {
        EvangelismGroup group = groupRepo.findById(groupId)
            .orElseThrow(() -> AppException.notFound("조를 찾을 수 없습니다."));
        group.update(req.name());
        return GroupResponse.from(group);
    }

    @Transactional
    public void deleteGroup(Long groupId) {
        groupRepo.lockGroups();
        EvangelismGroup group = groupRepo.findById(groupId)
            .orElseThrow(() -> AppException.notFound("조를 찾을 수 없습니다."));
        group.deactivate();
        groupRepo.saveAndFlush(group);
        memberRepo.deleteByGroupId(groupId);
    }

    @Transactional
    public GroupResponse updateGroupMembers(Long groupId, GroupMembersRequest req) {
        groupRepo.lockGroups();
        EvangelismGroup group = groupRepo.findById(groupId)
            .orElseThrow(() -> AppException.notFound("조를 찾을 수 없습니다."));

        if (!group.isActive()) throw AppException.badRequest("삭제된 조는 변경할 수 없습니다.");
        if (req.teacherIds() == null || req.teacherIds().stream().distinct().count() != req.teacherIds().size()) {
            throw AppException.badRequest("중복되지 않은 교사 목록을 보내주세요.");
        }
        for (Long teacherId : req.teacherIds()) {
            if (memberRepo.findActiveByTeacherId(teacherId).stream().anyMatch(m -> !m.getGroup().getId().equals(groupId))) {
                throw AppException.conflict("이미 다른 조에 속한 교사입니다. 이동 기능을 이용해주세요.");
            }
        }
        memberRepo.deleteByGroupId(groupId);

        List<EvangelismGroupMember> newMembers = req.teacherIds().stream().map(teacherId -> {
            User teacher = userRepo.findById(teacherId)
                .orElseThrow(() -> AppException.notFound("교사를 찾을 수 없습니다: " + teacherId));
            return EvangelismGroupMember.builder().group(group).teacher(teacher).build();
        }).toList();

        memberRepo.saveAll(newMembers);

        return GroupResponse.from(groupRepo.findAllActiveWithMembers().stream()
            .filter(g -> g.getId().equals(groupId))
            .findFirst()
            .orElseThrow());
    }

    public List<ScheduleResponse> getAllSchedules() {
        return scheduleRepo.findAllWithAssignments().stream()
            .map(ScheduleResponse::from)
            .toList();
    }

    @Transactional
    public void moveTeacher(Long teacherId, Long fromGroupId, Long toGroupId) {
        groupRepo.lockGroups();
        User teacher = userRepo.findById(teacherId).orElseThrow(() -> AppException.notFound("교사를 찾을 수 없습니다."));
        if (!teacher.isActive()) throw AppException.badRequest("활성 교사만 배정할 수 있습니다.");
        List<EvangelismGroupMember> current = memberRepo.findActiveByTeacherId(teacherId);
        Long actual = current.isEmpty() ? null : current.get(0).getGroup().getId();
        if (current.size() > 1 || !java.util.Objects.equals(actual, fromGroupId)) {
            throw AppException.conflict("조 편성이 변경되었습니다. 새로고침 후 다시 이동해주세요.");
        }
        if (java.util.Objects.equals(actual, toGroupId)) return;
        EvangelismGroup target = toGroupId == null ? null : groupRepo.findById(toGroupId)
                .filter(EvangelismGroup::isActive).orElseThrow(() -> AppException.badRequest("이동할 조가 없습니다."));
        memberRepo.deleteAll(current);
        memberRepo.flush();
        if (target != null) memberRepo.save(EvangelismGroupMember.builder().teacher(teacher).group(target).build());
    }

    public List<ScheduleResponse> getUpcomingSchedules() {
        return scheduleRepo.findUpcomingWithAssignments(LocalDate.now()).stream()
            .map(ScheduleResponse::from)
            .toList();
    }

    /** Validate every source before any move; the group lock serializes all membership edits. */
    @Transactional
    public int moveTeachers(List<TeacherMoveRequest> requests) {
        if (requests == null || requests.isEmpty() || requests.size() > 500)
            throw AppException.badRequest("1~500명의 교사를 선택해주세요.");
        groupRepo.lockGroups();
        var seen = new java.util.HashSet<Long>();
        for (var req : requests) {
            if (req == null || req.teacherId() == null || !seen.add(req.teacherId()))
                throw AppException.badRequest("중복되지 않은 교사 목록을 보내주세요.");
            User teacher = userRepo.findById(req.teacherId()).orElseThrow(() -> AppException.notFound("교사를 찾을 수 없습니다."));
            if (!teacher.isActive()) throw AppException.badRequest("활성 교사만 배정할 수 있습니다.");
            var current = memberRepo.findActiveByTeacherId(req.teacherId());
            Long actual = current.isEmpty() ? null : current.get(0).getGroup().getId();
            if (current.size() > 1 || !java.util.Objects.equals(actual, req.fromGroupId()))
                throw AppException.conflict("조 편성이 변경되었습니다. 명단을 확인하고 다시 선택해주세요.");
            if (req.toGroupId() != null) groupRepo.findById(req.toGroupId()).filter(EvangelismGroup::isActive)
                .orElseThrow(() -> AppException.badRequest("이동할 조가 없습니다."));
        }
        for (var req : requests) moveTeacher(req.teacherId(), req.fromGroupId(), req.toGroupId());
        return requests.size();
    }

    /** All dates commit together. Retrying with the same operation key returns the first result. */
    @Transactional
    public List<ScheduleResponse> createSchedules(List<ScheduleRequest> requests) {
        if (requests == null || requests.isEmpty() || requests.size() > 52)
            throw AppException.badRequest("일정은 한 번에 1~52개까지 등록할 수 있습니다.");
        groupRepo.lockGroups();
        var seen = new java.util.HashSet<String>();
        for (var req : requests) {
            if (req == null || req.scheduledDate() == null || req.groupId() == null)
                throw AppException.badRequest("각 일정의 날짜와 담당 조를 선택해주세요.");
            groupRepo.findById(req.groupId()).filter(EvangelismGroup::isActive)
                .orElseThrow(() -> AppException.badRequest("사용 가능한 담당 조를 선택해주세요."));
            if (!seen.add(req.scheduledDate() + ":" + req.groupId()))
                throw AppException.badRequest("같은 날짜와 담당 조가 중복되었습니다.");
            if (scheduleRepo.existsByScheduledDateAndResponsibleGroupIdAndStatusNot(req.scheduledDate(), req.groupId(), "CANCELED"))
                throw AppException.conflict(req.scheduledDate() + "에 해당 조의 일정이 이미 있습니다.");
        }
        return requests.stream().map(this::createSchedule).toList();
    }

    public MyStatusResponse getMyStatus(Long teacherId) {
        List<EvangelismGroupMember> memberships = memberRepo.findActiveByTeacherId(teacherId);
        if (memberships.isEmpty()) return new MyStatusResponse(null, null, List.of());

        EvangelismGroup myGroup = memberships.get(0).getGroup();
        GroupResponse myGroupResponse = GroupResponse.from(myGroup);

        List<ScheduleResponse> upcoming = scheduleRepo
            .findUpcomingByGroupId(myGroup.getId(), LocalDate.now())
            .stream().map(ScheduleResponse::from).toList();

        ScheduleResponse next = upcoming.isEmpty() ? null : upcoming.get(0);
        return new MyStatusResponse(myGroupResponse, next, upcoming);
    }

    public List<ScheduleResponse> getMySchedules(Long teacherId) {
        List<EvangelismGroupMember> memberships = memberRepo.findActiveByTeacherId(teacherId);
        if (memberships.isEmpty()) return List.of();

        Long groupId = memberships.get(0).getGroup().getId();
        return scheduleRepo.findAllByGroupId(groupId).stream()
            .map(ScheduleResponse::from)
            .toList();
    }

    @Transactional
    public ScheduleResponse createSchedule(ScheduleRequest req) {
        groupRepo.lockGroups();
        validateSchedule(req, null);
        EvangelismGroup responsibleGroup = req.groupId() != null
            ? groupRepo.findById(req.groupId()).orElseThrow(() -> AppException.notFound("조를 찾을 수 없습니다."))
            : null;
        EvangelismSchedule schedule = EvangelismSchedule.builder()
            .scheduledDate(req.scheduledDate())
            .responsibleGroup(responsibleGroup)
            .build();
        scheduleRepo.save(schedule);
        saveAssignments(schedule, req.teacherIds(), req.groupId());
        return ScheduleResponse.from(scheduleRepo.findAllWithAssignments().stream()
            .filter(s -> s.getId().equals(schedule.getId()))
            .findFirst()
            .orElseThrow());
    }

    @Transactional
    public ScheduleResponse updateSchedule(Long scheduleId, ScheduleRequest req) {
        groupRepo.lockGroups();
        validateSchedule(req, scheduleId);
        EvangelismSchedule schedule = scheduleRepo.findById(scheduleId)
            .orElseThrow(() -> AppException.notFound("일정을 찾을 수 없습니다."));
        EvangelismGroup responsibleGroup = req.groupId() != null
            ? groupRepo.findById(req.groupId()).orElseThrow(() -> AppException.notFound("조를 찾을 수 없습니다."))
            : null;
        schedule.update(req.scheduledDate(), responsibleGroup);
        assignmentRepo.deleteByScheduleId(scheduleId);
        assignmentRepo.flush();
        saveAssignments(schedule, req.teacherIds(), req.groupId());
        return ScheduleResponse.from(scheduleRepo.findAllWithAssignments().stream()
            .filter(s -> s.getId().equals(scheduleId))
            .findFirst()
            .orElseThrow());
    }

    @Transactional
    public void deleteSchedule(Long scheduleId) {
        if (!scheduleRepo.existsById(scheduleId))
            throw AppException.notFound("일정을 찾을 수 없습니다.");
        assignmentRepo.deleteByScheduleId(scheduleId);
        scheduleRepo.deleteById(scheduleId);
    }

    @Transactional
    public ScheduleResponse cancelSchedule(Long scheduleId) {
        EvangelismSchedule schedule = scheduleRepo.findById(scheduleId)
            .orElseThrow(() -> AppException.notFound("일정을 찾을 수 없습니다."));
        schedule.cancel();
        return ScheduleResponse.from(schedule);
    }

    private void saveAssignments(EvangelismSchedule schedule, List<Long> teacherIds, Long groupId) {
        List<Long> actualTeacherIds = teacherIds;

        if (groupId != null) {
            EvangelismGroup group = groupRepo.findById(groupId)
                .orElseThrow(() -> AppException.notFound("조를 찾을 수 없습니다."));
            actualTeacherIds = group.getMembers().stream()
                .map(m -> m.getTeacher().getId())
                .toList();
        }

        if (actualTeacherIds == null || actualTeacherIds.isEmpty()) return;

        List<EvangelismAssignment> assignments = actualTeacherIds.stream().map(teacherId -> {
            User teacher = userRepo.findById(teacherId)
                .orElseThrow(() -> AppException.notFound("교사를 찾을 수 없습니다: " + teacherId));

            List<EvangelismGroupMember> memberships = memberRepo.findActiveByTeacherId(teacherId);
            EvangelismGroup group = memberships.isEmpty() ? null : memberships.get(0).getGroup();

            return EvangelismAssignment.builder()
                .schedule(schedule)
                .teacher(teacher)
                .group(group)
                .build();
        }).toList();

        assignmentRepo.saveAll(assignments);
    }

    private void validateSchedule(ScheduleRequest req, Long excludeId) {
        if (req == null || req.scheduledDate() == null) throw AppException.badRequest("전도 날짜를 선택해주세요.");
        if (req.groupId() == null) return; // Preserve the existing direct-teacher API.
        groupRepo.findById(req.groupId()).filter(EvangelismGroup::isActive)
            .orElseThrow(() -> AppException.badRequest("사용 가능한 담당 조를 선택해주세요."));
        boolean duplicate = excludeId == null
            ? scheduleRepo.existsByScheduledDateAndResponsibleGroupIdAndStatusNot(req.scheduledDate(), req.groupId(), "CANCELED")
            : scheduleRepo.existsByScheduledDateAndResponsibleGroupIdAndStatusNotAndIdNot(req.scheduledDate(), req.groupId(), "CANCELED", excludeId);
        if (duplicate) throw AppException.conflict(req.scheduledDate() + "에 해당 조의 일정이 이미 있습니다.");
    }
}
