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
        EvangelismGroup group = groupRepo.findById(groupId)
            .orElseThrow(() -> AppException.notFound("조를 찾을 수 없습니다."));
        group.deactivate();
    }

    @Transactional
    public GroupResponse updateGroupMembers(Long groupId, GroupMembersRequest req) {
        EvangelismGroup group = groupRepo.findById(groupId)
            .orElseThrow(() -> AppException.notFound("조를 찾을 수 없습니다."));

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

    public List<ScheduleResponse> getUpcomingSchedules() {
        return scheduleRepo.findUpcomingWithAssignments(LocalDate.now()).stream()
            .map(ScheduleResponse::from)
            .toList();
    }

    public MyStatusResponse getMyStatus(Long teacherId) {
        List<EvangelismGroupMember> memberships = memberRepo.findByTeacherId(teacherId);
        GroupResponse myGroup = memberships.isEmpty() ? null
            : GroupResponse.from(memberships.get(0).getGroup());

        List<ScheduleResponse> upcoming = scheduleRepo
            .findUpcomingByTeacherIdWithAssignments(teacherId, LocalDate.now())
            .stream().map(ScheduleResponse::from).toList();

        ScheduleResponse next = upcoming.isEmpty() ? null : upcoming.get(0);

        return new MyStatusResponse(myGroup, next, upcoming);
    }

    public List<ScheduleResponse> getMySchedules(Long teacherId) {
        return scheduleRepo.findAllByTeacherIdWithAssignments(teacherId).stream()
            .map(ScheduleResponse::from)
            .toList();
    }

    @Transactional
    public ScheduleResponse createSchedule(ScheduleRequest req) {
        EvangelismSchedule schedule = EvangelismSchedule.builder()
            .scheduledDate(req.scheduledDate())
            .build();
        scheduleRepo.save(schedule);
        saveAssignments(schedule, req.teacherIds(), req.groupId());
        return ScheduleResponse.from(scheduleRepo.findById(schedule.getId()).orElseThrow());
    }

    @Transactional
    public ScheduleResponse updateSchedule(Long scheduleId, ScheduleRequest req) {
        EvangelismSchedule schedule = scheduleRepo.findById(scheduleId)
            .orElseThrow(() -> AppException.notFound("일정을 찾을 수 없습니다."));

        schedule.update(req.scheduledDate());
        assignmentRepo.deleteByScheduleId(scheduleId);
        saveAssignments(schedule, req.teacherIds(), req.groupId());
        return ScheduleResponse.from(scheduleRepo.findById(scheduleId).orElseThrow());
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

            List<EvangelismGroupMember> memberships = memberRepo.findByTeacherId(teacherId);
            EvangelismGroup group = memberships.isEmpty() ? null : memberships.get(0).getGroup();

            return EvangelismAssignment.builder()
                .schedule(schedule)
                .teacher(teacher)
                .group(group)
                .build();
        }).toList();

        assignmentRepo.saveAll(assignments);
    }
}
