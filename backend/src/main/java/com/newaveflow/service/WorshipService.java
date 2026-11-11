package com.newaveflow.service;

import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class WorshipService {
 private final WorshipRegistryRepository registry;
 private final WorshipMemberRepository members;
 private final WorshipWeekRepository weeks;
 private final WorshipTaskRepository tasks;
 private final UserRepository users;
 private final StudentRepository students;
 private final AccountDeletionRequestRepository deletions;
 private final OfficerAppointmentRepository appointments;
 private final OfficerAccessService access;
 private final Clock clock;
 private final jakarta.persistence.EntityManager em;
 public record Definition(String key,String phase,String label,boolean leaderOnly,boolean review) {}
 public static final List<Definition> DEFINITIONS=List.of(
  new Definition("teacher","before","헌금기도 선생님 안내",true,false),
  new Definition("students","before","헌금위원 학생 확인",true,false),
  new Definition("banner","before","현수막 부착",false,true),
  new Definition("water","before","강대상 준비 · 생수·티슈·거치대",false,true),
  new Definition("video","before","1층 예배 영상 세팅",true,false),
  new Definition("prayer","before","대표기도 학생 안내",false,false),
  new Definition("offering","during","헌금위원 학생 안내",true,false),
  new Definition("pulpit","after","강대상 정리",true,false),
  new Definition("hall","after","예배당 정리",true,false),
  new Definition("cushion","after","방석 정리",true,false));
 public static final List<String> GRADES=List.of("중1","중2","중3","고1","고2","고3");
 public record Person(Long id,String name,String label) {}
 public record MemberInput(Long revision,List<Long> userIds) {}
 public record CommitteeInput(Long revision,String intercessionGrade,Long offeringPrayerId,Long representativePrayerId,List<Long> offeringIds,String noticeMessage) {}
 public record CheckInput(Long revision,Boolean checked) {}
 public record AssignInput(Long revision,Long userId) {}
 public record Stamp(String name,LocalDateTime at) {}
 public record TaskView(String key,String phase,String label,boolean leaderOnly,boolean review,long revision,Person assignee,boolean assigneeAvailable,Stamp completed,Stamp reviewed,boolean canCheck) {}
 public record State(Long me,boolean canLead,boolean canWork,long teamRevision,List<Person> team,List<Person> candidates,List<Person> students,LocalDate date,long revision,String intercessionGrade,Person offeringPrayer,Person representativePrayer,List<Person> offerings,String noticeMessage,Stamp announced,List<TaskView> tasks) {}
 private boolean eligible(User u){return u!=null&&u.isActive()&&!u.isSuspended()&&!deletions.existsByUserId(u.getId());}
 private User actor(User p){var u=access.current(p);if(!eligible(u))throw AppException.forbidden("계정 상태를 확인해주세요.");return u;}
 private boolean leader(User u){return access.all(u)||access.hasOffice(u,OfficerPosition.WORSHIP);}
 private boolean worker(User u){return leader(u)||members.existsById(u.getId());}
 public boolean canEnter(User principal){var u=actor(principal);return access.common(u)||worker(u);}
 private void viewAllowed(User u){if(!canEnter(u))throw AppException.forbidden("예배운영팀만 확인할 수 있습니다.");}
 private void leadAllowed(User u){if(!leader(u))throw AppException.forbidden("팀장만 변경할 수 있습니다.");}
 // Match the account/office lock order; stale sessions cannot retain a removed permission.
 private User writer(User principal){
  Long id=principal.getId();long version=principal.getAuthVersion();em.clear();
  var u=users.lockAllForStatusChange().stream().filter(p->p.getId().equals(id)).findFirst().orElseThrow(()->AppException.unauthorized("다시 로그인해주세요."));
  if(!eligible(u)||u.getAuthVersion()!=version)throw AppException.forbidden("계정 상태가 변경됐습니다. 다시 로그인해주세요.");
  return u;
 }
 private void revision(Long expected,long actual){if(expected==null||expected!=actual)throw AppException.conflict("다른 변경사항이 있습니다. 최신 내용을 확인해주세요.");}
 private LocalDate date(LocalDate value){
  LocalDate d=value==null?LocalDate.now(clock).with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY)):value;
  if(d.getYear()<2000||d.getYear()>2100||d.getDayOfWeek()!=DayOfWeek.SUNDAY)throw AppException.badRequest("주일 날짜를 선택해주세요.");return d;
 }
 private WorshipWeek week(LocalDate value){var d=date(value);return weeks.findById(d).orElseGet(()->{var w=new WorshipWeek();w.setWorshipDate(d);w.setId(d.toEpochDay());return w;});}
 private Person person(User u){return u==null?null:new Person(u.getId(),u.getName(),u.getRole().name());}
 private Person student(Student s){return s==null?null:new Person(s.getId(),s.getName(),s.getGrade());}
 private Stamp stamp(User u,LocalDateTime at){return at==null?null:new Stamp(u==null?"삭제된 계정":u.getName(),at);}
 private List<Person> team(){
  var result=new LinkedHashMap<Long,Person>();
  appointments.findByTermYear(access.activeYear()).stream().filter(a->a.getPosition()==OfficerPosition.WORSHIP&&eligible(a.getUser())).forEach(a->result.put(a.getUser().getId(),new Person(a.getUser().getId(),a.getUser().getName(),"팀장")));
  members.findAll().stream().filter(m->eligible(m.getUser())).sorted(Comparator.comparing(m->m.getUser().getName())).forEach(m->result.putIfAbsent(m.getId(),new Person(m.getId(),m.getUser().getName(),"팀원")));
  return List.copyOf(result.values());
 }
 private boolean canCheck(Definition d,WorshipTask t,User u){
  return leader(u)||(!d.leaderOnly()&&worker(u)&&(t.getAssignee()==null||t.getAssignee().getId().equals(u.getId())));
 }
 private WorshipTask task(WorshipWeek w,Definition d,List<WorshipTask> rows){
  return rows.stream().filter(t->t.getTaskKey().equals(d.key())).findFirst().orElseGet(()->{var t=new WorshipTask();t.setWeek(w);t.setTaskKey(d.key());return t;});
 }
 public State state(LocalDate requested,User principal){
  var u=actor(principal);viewAllowed(u);var w=week(requested);var rows=tasks.findByWeekWorshipDate(w.getWorshipDate());boolean lead=leader(u);
  var team=team();var teamIds=team.stream().map(Person::id).toList();
  return new State(u.getId(),lead,worker(u),registry.findById(1L).map(WorshipRegistry::getRevision).orElse(0L),team,
   lead?users.findByIsActiveTrue().stream().filter(this::eligible).sorted(Comparator.comparing(User::getName)).map(this::person).toList():List.of(),
   lead?students.findAllByIsActiveTrueOrderByGradeAscNameAsc().stream().map(this::student).toList():List.of(),
   w.getWorshipDate(),w.getRevision(),w.getIntercessionGrade(),person(w.getOfferingPrayer()),student(w.getRepresentativePrayer()),w.getOfferings().stream().map(this::student).toList(),w.getNoticeMessage(),stamp(w.getAnnouncedBy(),w.getAnnouncedAt()),
   DEFINITIONS.stream().map(d->{var t=task(w,d,rows);return new TaskView(d.key(),d.phase(),d.label(),d.leaderOnly(),d.review(),t.getRevision(),person(t.getAssignee()),t.getAssignee()==null||teamIds.contains(t.getAssignee().getId()),stamp(t.getCompletedBy(),t.getCompletedAt()),stamp(t.getReviewedBy(),t.getReviewedAt()),canCheck(d,t,u));}).toList());
 }
 @Transactional public State members(LocalDate date,MemberInput in,User principal){
  var u=writer(principal);leadAllowed(u);var r=registry.findById(1L).orElseGet(WorshipRegistry::new);revision(in.revision(),r.getRevision());
  if(in.userIds()==null||in.userIds().size()>150||in.userIds().stream().anyMatch(Objects::isNull)||new HashSet<>(in.userIds()).size()!=in.userIds().size())throw AppException.badRequest("팀원을 확인해주세요.");
  var selected=in.userIds().stream().map(this::validUser).toList();
  // Delete only removed rows, so @MapsId inserts do not collide with pending deletes.
  members.findAll().stream().filter(m->!in.userIds().contains(m.getId())).forEach(members::delete);members.flush();
  selected.forEach(p->{if(!members.existsById(p.getId())){var m=new WorshipMember();m.setUser(p);members.save(m);}});
  r.setRevision(r.getRevision()+1);registry.save(r);return state(date,u);
 }
 private User validUser(Long id){var u=users.findById(id).orElseThrow(()->AppException.badRequest("교사를 확인해주세요."));if(!eligible(u))throw AppException.badRequest("활동 중인 교사를 선택해주세요.");return u;}
 private Student validStudent(Long id){var s=students.findById(id).orElseThrow(()->AppException.badRequest("학생을 확인해주세요."));if(!s.isActive())throw AppException.badRequest("재적 학생을 선택해주세요.");return s;}
 private void clearReview(WorshipTask t){t.setReviewedAt(null);t.setReviewedBy(null);}
 private void clearCheck(WorshipTask t){t.setCompletedAt(null);t.setCompletedBy(null);clearReview(t);}
 private void resetTasks(WorshipWeek w,Set<String> keys){
  tasks.findByWeekWorshipDate(w.getWorshipDate()).stream().filter(t->keys.contains(t.getTaskKey())).forEach(t->{clearCheck(t);t.setRevision(t.getRevision()+1);});
 }
 private Long id(User u){return u==null?null:u.getId();}
 private Long sid(Student s){return s==null?null:s.getId();}
 @Transactional public State committee(LocalDate date,CommitteeInput in,User principal){
  var u=writer(principal);leadAllowed(u);var w=week(date);revision(in.revision(),w.getRevision());
  String grade=in.intercessionGrade()==null?"":in.intercessionGrade().trim(),message=in.noticeMessage()==null?"":in.noticeMessage().trim();
  if((!grade.isEmpty()&&!GRADES.contains(grade))||message.length()>160||in.offeringIds()==null||in.offeringIds().size()>30||in.offeringIds().stream().anyMatch(Objects::isNull)||new HashSet<>(in.offeringIds()).size()!=in.offeringIds().size())throw AppException.badRequest("예배위원과 안내 문구를 확인해주세요.");
  var teacher=in.offeringPrayerId()==null?null:validUser(in.offeringPrayerId());
  var prayer=in.representativePrayerId()==null?null:validStudent(in.representativePrayerId());
  var offerings=in.offeringIds().stream().map(this::validStudent).toList();
  Set<String> reset=new HashSet<>();
  if(!Objects.equals(id(w.getOfferingPrayer()),id(teacher)))reset.add("teacher");
  if(!Objects.equals(sid(w.getRepresentativePrayer()),sid(prayer)))reset.add("prayer");
  if(!w.getOfferings().stream().map(Student::getId).toList().equals(in.offeringIds()))reset.addAll(List.of("students","offering"));
  boolean changed=!grade.equals(w.getIntercessionGrade())||!message.equals(w.getNoticeMessage())||!reset.isEmpty();
  w.setIntercessionGrade(grade);w.setOfferingPrayer(teacher);w.setRepresentativePrayer(prayer);w.getOfferings().clear();w.getOfferings().addAll(offerings);w.setNoticeMessage(message);
  if(changed){w.setAnnouncedAt(null);w.setAnnouncedBy(null);}
  w.setRevision(w.getRevision()+1);w=weeks.save(w);resetTasks(w,reset);return state(date,u);
 }
 @Transactional public State announce(LocalDate date,CheckInput in,User principal){
  var u=writer(principal);leadAllowed(u);var w=week(date);revision(in.revision(),w.getRevision());if(in.checked()==null)throw AppException.badRequest("공지 여부를 확인해주세요.");
  if(in.checked()&&(w.getIntercessionGrade().isBlank()||w.getOfferingPrayer()==null||w.getRepresentativePrayer()==null||w.getOfferings().isEmpty()))throw AppException.badRequest("예배위원을 먼저 등록해주세요.");
  w.setAnnouncedBy(in.checked()?u:null);w.setAnnouncedAt(in.checked()?LocalDateTime.now(clock):null);w.setRevision(w.getRevision()+1);weeks.save(w);return state(date,u);
 }
 private Definition definition(String key){return DEFINITIONS.stream().filter(d->d.key().equals(key)).findFirst().orElseThrow(()->AppException.badRequest("준비 항목을 확인해주세요."));}
 @Transactional public State check(LocalDate date,String key,boolean review,CheckInput in,User principal){
  var u=writer(principal);var d=definition(key);var w=week(date);var t=task(w,d,tasks.findByWeekWorshipDate(w.getWorshipDate()));revision(in.revision(),t.getRevision());
  if(in.checked()==null)throw AppException.badRequest("완료 여부를 확인해주세요.");
  if(review){leadAllowed(u);if(!d.review())throw AppException.badRequest("팀장 확인 항목이 아닙니다.");if(in.checked()&&t.getCompletedAt()==null)throw AppException.badRequest("준비가 끝나면 확인해주세요.");t.setReviewedBy(in.checked()?u:null);t.setReviewedAt(in.checked()?LocalDateTime.now(clock):null);}
  else{if(!canCheck(d,t,u))throw AppException.forbidden("담당자만 체크할 수 있습니다.");t.setCompletedBy(in.checked()?u:null);t.setCompletedAt(in.checked()?LocalDateTime.now(clock):null);clearReview(t);}
  t.setWeek(weeks.save(w));t.setRevision(t.getRevision()+1);tasks.save(t);return state(date,u);
 }
 @Transactional public State assign(LocalDate date,String key,AssignInput in,User principal){
  var u=writer(principal);leadAllowed(u);var d=definition(key);if(d.leaderOnly())throw AppException.badRequest("팀장 담당 항목입니다.");
  var w=week(date);var t=task(w,d,tasks.findByWeekWorshipDate(w.getWorshipDate()));revision(in.revision(),t.getRevision());
  User selected=null;if(in.userId()!=null){selected=validUser(in.userId());if(team().stream().noneMatch(p->p.id().equals(in.userId())))throw AppException.badRequest("예배운영팀원을 선택해주세요.");}
  if(!Objects.equals(id(t.getAssignee()),id(selected)))clearCheck(t);
  t.setAssignee(selected);t.setWeek(weeks.save(w));t.setRevision(t.getRevision()+1);tasks.save(t);return state(date,u);
 }
}
