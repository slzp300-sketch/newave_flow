package com.newaveflow;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.dto.evangelism.EvangelismDto.*;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import com.newaveflow.service.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.test.context.ActiveProfiles;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(showSql=false) @ActiveProfiles("test")
@Import({EvangelismService.class, OperationService.class, EvangelismBulkTest.JsonConfig.class})
class EvangelismBulkTest {
 @TestConfiguration static class JsonConfig { @Bean ObjectMapper mapper(){return new ObjectMapper().findAndRegisterModules();} }
 @Autowired EvangelismService service;
 @Autowired OperationService operations;
 @Autowired UserRepository users;
 @Autowired EvangelismGroupRepository groups;
 @Autowired EvangelismGroupMemberRepository members;
 @Autowired EvangelismScheduleRepository schedules;
 @Autowired EntityManager em;
 User teacher(){return users.saveAndFlush(User.builder().name("가상교사").email(UUID.randomUUID()+"@example.invalid").password("synthetic").role(User.Role.TEACHER).build());}
 EvangelismGroup group(){return groups.saveAndFlush(EvangelismGroup.builder().name("가상 조").build());}
 LocalDate day=LocalDate.of(2026,11,7);

 @Test void movesSeveralTeachersAndCanUnassignWithoutDuplicates(){
  var a=teacher();var b=teacher();var first=group();var second=group();
  members.saveAndFlush(EvangelismGroupMember.builder().group(first).teacher(a).build());
  assertEquals(2,service.moveTeachers(List.of(new TeacherMoveRequest(a.getId(),first.getId(),second.getId()),new TeacherMoveRequest(b.getId(),null,second.getId()))));
  assertEquals(second.getId(),members.findActiveByTeacherId(a.getId()).get(0).getGroup().getId());
  assertEquals(second.getId(),members.findActiveByTeacherId(b.getId()).get(0).getGroup().getId());
  service.moveTeachers(List.of(new TeacherMoveRequest(a.getId(),second.getId(),null)));
  assertTrue(members.findActiveByTeacherId(a.getId()).isEmpty());
 }
 @Test void staleMemberRejectsWholeSelectionBeforeFirstMove(){
  var a=teacher();var b=teacher();var first=group();var second=group();
  members.saveAndFlush(EvangelismGroupMember.builder().group(first).teacher(b).build());
  assertThrows(AppException.class,()->service.moveTeachers(List.of(new TeacherMoveRequest(a.getId(),null,second.getId()),new TeacherMoveRequest(b.getId(),null,second.getId()))));
  assertTrue(members.findActiveByTeacherId(a.getId()).isEmpty());
  assertEquals(first.getId(),members.findActiveByTeacherId(b.getId()).get(0).getGroup().getId());
 }
 @Test void inactiveDestinationIsRejected(){
  var a=teacher();var g=group();g.deactivate();groups.flush();
  assertThrows(AppException.class,()->service.moveTeachers(List.of(new TeacherMoveRequest(a.getId(),null,g.getId()))));
  assertTrue(members.findActiveByTeacherId(a.getId()).isEmpty());
 }
 @Test void schedulesRotateAndRetainGroupForEmptyGroups(){
  var a=group();var b=group();
  var result=service.createSchedules(List.of(new ScheduleRequest(day,null,a.getId()),new ScheduleRequest(day.plusWeeks(1),null,b.getId())));
  assertEquals(2,result.size());assertEquals(a.getId(),result.get(0).groupId());assertEquals("가상 조",result.get(0).groupName());
  em.flush();em.clear();assertEquals(2,schedules.count());assertTrue(service.getAllSchedules().get(0).assignments().isEmpty());
 }
 @Test void duplicateExistingDatePreventsAnyScheduleInBatch(){
  var g=group();service.createSchedule(new ScheduleRequest(day,null,g.getId()));long before=schedules.count();
  assertThrows(AppException.class,()->service.createSchedules(List.of(new ScheduleRequest(day.plusWeeks(1),null,g.getId()),new ScheduleRequest(day,null,g.getId()))));
  assertEquals(before,schedules.count());
 }
 @Test void duplicateRowsAreRejectedBeforeAnyScheduleIsCreated(){
  var g=group();var req=new ScheduleRequest(day,null,g.getId());
  assertThrows(AppException.class,()->service.createSchedules(List.of(req,req)));
  assertEquals(0,schedules.count());
 }
 @Test void replayReturnsSameBulkResultWithoutDuplicateSchedules(){
  var actor=teacher();var g=group();var rows=List.of(new ScheduleRequest(day,null,g.getId()),new ScheduleRequest(day.plusWeeks(1),null,g.getId()));
  var type=new TypeReference<List<ScheduleResponse>>(){};
  var first=operations.execute(actor.getId(),"synthetic-ev-bulk-001","evangelism-schedules",rows,type,()->service.createSchedules(rows));
  var replay=operations.execute(actor.getId(),"synthetic-ev-bulk-001","evangelism-schedules",rows,type,()->service.createSchedules(rows));
  assertEquals(first,replay);assertEquals(2,schedules.count());
 }
 @Test void canceledScheduleDoesNotBlockReplacement(){
  var g=group();var req=new ScheduleRequest(day,null,g.getId());
  var old=service.createSchedule(req);service.cancelSchedule(old.id());
  assertEquals(1,service.createSchedules(List.of(req)).size());assertEquals(2,schedules.count());
 }
}
