package com.newaveflow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.entity.*;
import com.newaveflow.entity.IntercessionRequest.Status;
import com.newaveflow.repository.*;
import com.newaveflow.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.net.URI;
import java.util.*;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class IntercessionService {
 private final IntercessionRegistryRepository registry;
 private final IntercessionMemberRepository members;
 private final IntercessionRequestRepository requests;
 private final IntercessionMeetingRepository meetings;
 private final UserRepository users;
 private final AccountDeletionRequestRepository deletions;
 private final OfficerAppointmentRepository appointments;
 private final OfficerAccessService access;
 private final PrayerParticipationService participation;
 private final ObjectMapper json;
 private final Clock clock;
 private final jakarta.persistence.EntityManager em;
 public static final List<String> CATEGORIES=List.of("청소년부","학생","교사","가정","기타");
 public record MemberInput(Long revision,List<Long> userIds) {}
 public record RequestInput(String title,String body,String category,boolean proxy,String senderName,boolean share,boolean anonymous) {}
 public record ReviewInput(Long revision,String action,String publicTitle,String publicText,boolean anonymous) {}
 public record DecisionInput(Long revision,Boolean publish,Boolean completed,String publicTitle,String publicText,Boolean anonymous) {}
 public record UpdateInput(Long revision,String title,String body,String note) {}
 public record UpdateReviewInput(Long revision,Boolean updatePublic,String publicTitle,String publicText) {}
 public record PrayerUpdate(String title,String body,String note,LocalDateTime submittedAt) {}
 public record UpdateHistory(PrayerUpdate update,LocalDateTime reviewedAt,boolean shared) {}
 public record Revision(Long revision) {}
 public record MeetingInput(Long revision,LocalTime startTime,int duration,Long hostId,String zoomUrl,Boolean canceled,String cancellationReason) {
  // Older clients may update a host without knowing about cancellation. Preserve its saved state.
  public MeetingInput(Long revision,LocalTime startTime,int duration,Long hostId,String zoomUrl){this(revision,startTime,duration,hostId,zoomUrl,null,null);}
 }
 public record MaterialsInput(Long revision,List<Long> requestIds) {}
 public record Person(Long id,String name,String role) {}
 public record RequestView(Long id,long revision,String title,String body,String publicTitle,String publicText,String category,String author,String source,boolean share,boolean anonymous,String state,LocalDateTime date,boolean own,boolean canReadOriginal,boolean completed,PrayerUpdate pendingUpdate,List<UpdateHistory> updates) {}
 public record RequestPage(List<RequestView> items,long total,int page,int pages) {}
 public record PaperItem(Long id,long revision,String title,String body,String category,String author) {}
 public record MeetingView(LocalDate date,LocalTime time,int duration,Long hostId,String hostName,String zoom,long revision,int voters,List<RequestView> selected,List<PaperItem> paper,boolean paperStale,LocalDateTime preparedAt,boolean canceled,String cancellationReason) {}
 public record State(Long me,boolean canManage,boolean canLead,boolean canViewTeam,LocalDate week,long teamRevision,List<Person> team,List<Person> candidates,List<MeetingView> meetings,long pending,long published) {}

 private User actor(User principal) {
  var u=access.current(principal);
  if(deletions.existsByUserId(u.getId()))throw AppException.forbidden("탈퇴 처리 중인 계정입니다.");
  return u;
 }
 private boolean eligible(User u){return u!=null&&u.isActive()&&!u.isSuspended()&&!deletions.existsByUserId(u.getId());}
 public boolean lead(User u){return access.all(u)||access.hasOffice(u,OfficerPosition.INTERCESSION);}
 public boolean canManage(User principal){var u=actor(principal);return lead(u)||members.existsById(u.getId());}
 public boolean canViewTeam(User principal){var u=actor(principal);return access.common(u)||canManage(u);}
 private void manage(User u){if(!canManage(u))throw AppException.forbidden("중보기도팀만 변경할 수 있습니다.");}
 // Same lock order as account suspension and office changes. Recheck the current session after acquiring locks.
 private User writer(User principal){
  Long id=principal.getId();long version=principal.getAuthVersion();em.clear();
  var u=users.lockAllForStatusChange().stream().filter(p->p.getId().equals(id)).findFirst().orElseThrow(()->AppException.unauthorized("다시 로그인해주세요."));
  if(!eligible(u)||u.getAuthVersion()!=version)throw AppException.forbidden("계정 상태가 변경됐습니다. 다시 로그인해주세요.");
  return u;
 }
 private void revision(Long expected,long actual){if(expected==null||expected!=actual)throw AppException.conflict("내용이 변경됐습니다. 최신 내용을 확인한 뒤 다시 저장해주세요.");}
 private String text(String value,int max,boolean required){String s=value==null?"":value.trim();if(s.length()>max||(required&&s.isEmpty()))throw AppException.badRequest("입력 내용과 길이를 확인해주세요.");return s;}
 private LocalDate validDate(LocalDate date){if(date==null||date.getYear()<2000||date.getYear()>2100)throw AppException.badRequest("날짜를 확인해주세요.");return date;}
 private LocalDate monday(LocalDate date){return validDate(date==null?LocalDate.now(clock):date).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));}
 private LocalDate meetingDate(LocalDate date){validDate(date);if(date.getDayOfWeek()!=DayOfWeek.TUESDAY&&date.getDayOfWeek()!=DayOfWeek.THURSDAY)throw AppException.badRequest("화요일 또는 목요일을 선택해주세요.");return date;}
 private LocalDateTime now(){return LocalDateTime.now(clock);}
 private <T>T read(String value,TypeReference<T> type){try{return json.readValue(value,type);}catch(Exception e){throw new IllegalStateException("Invalid intercession data",e);}}
 private String write(Object value){try{return json.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
 private boolean publicRequest(IntercessionRequest r){return r.isShare()&&(r.getStatus()==Status.PUBLISHED||r.getStatus()==Status.ANSWERED);}
 private boolean owner(IntercessionRequest r,User u){return r.getAuthor()!=null&&r.getAuthor().getId().equals(u.getId());}
 private RequestView view(IntercessionRequest r,User u,boolean originals){
  boolean own=owner(r,u),original=originals&&(own||canManage(u));
  return new RequestView(r.getId(),r.getRevision(),original?r.getTitle():null,original?r.getBody():null,
   original||publicRequest(r)?r.getPublicTitle():null,original||publicRequest(r)?r.getPublicText():null,r.getCategory(),
   original||!r.isAnonymous()?r.getSenderName():null,original?r.getSource():null,r.isShare(),r.isAnonymous(),r.getStatus().name().toLowerCase(Locale.ROOT),r.getCreatedAt(),own,original,r.isPrayerCompleted(),
   original&&r.getPendingUpdate()!=null?read(r.getPendingUpdate(),new TypeReference<PrayerUpdate>(){}):null,original?read(r.getUpdateHistory(),new TypeReference<List<UpdateHistory>>(){}):List.of());
 }
 private IntercessionRequest request(Long id){return requests.findById(id).orElseThrow(()->AppException.notFound("기도제목을 찾을 수 없습니다."));}
 public RequestView detail(Long id,User principal){
  var u=actor(principal);var r=request(id);
  if(!owner(r,u)&&!canManage(u)&&!publicRequest(r))throw AppException.notFound("기도제목을 찾을 수 없습니다.");
  return view(r,u,true);
 }
 private Specification<IntercessionRequest> publicSpec(){return (r,q,b)->b.and(b.isTrue(r.get("share")),r.get("status").in(Status.PUBLISHED,Status.ANSWERED));}
 public RequestPage list(String scope,String status,String search,int page,User principal){
  var u=actor(principal);if(page<0||page>10000)throw AppException.badRequest("페이지를 확인해주세요.");
  boolean original=!"board".equals(scope);Specification<IntercessionRequest> spec;
  switch(scope){
   case "board" -> spec=publicSpec();
   case "mine" -> spec=(r,q,b)->b.equal(r.get("author").get("id"),u.getId());
   case "inbox" -> {manage(u);spec=(r,q,b)->b.conjunction();}
   default -> throw AppException.badRequest("목록을 확인해주세요.");
  }
  if(status!=null&&!status.isBlank()&&!status.equals("all")){
   if(status.equals("pending")&&scope.equals("inbox"))spec=spec.and((r,q,b)->b.and(b.notEqual(r.get("status"),Status.ARCHIVED),b.or(b.equal(r.get("status"),Status.PENDING),b.isNotNull(r.get("pendingUpdate")))));
   else if(status.equals("ongoing"))spec=spec.and((r,q,b)->b.and(r.get("status").in(Status.READY,Status.PUBLISHED),b.isFalse(r.get("prayerCompleted"))));
   else if(status.equals("completed"))spec=spec.and((r,q,b)->b.and(r.get("status").in(Status.READY,Status.ANSWERED),b.isTrue(r.get("prayerCompleted"))));
   else if(status.equals("private")&&scope.equals("inbox"))spec=spec.and((r,q,b)->b.isFalse(r.get("share")));
   else{Status parsed;try{parsed=Status.valueOf(status.toUpperCase(Locale.ROOT));}catch(Exception e){throw AppException.badRequest("상태를 확인해주세요.");}spec=spec.and((r,q,b)->b.equal(r.get("status"),parsed));}
  }
  String term=text(search,100,false);
  if(!term.isEmpty()){
   String escaped="%"+term.toLowerCase(Locale.ROOT).replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%";
   spec=spec.and((r,q,b)->original?b.or(b.like(b.lower(r.get("title")),escaped,'\\'),b.like(b.lower(r.get("senderName")),escaped,'\\')):b.or(b.like(b.lower(r.get("publicTitle")),escaped,'\\'),b.like(b.lower(r.get("publicText")),escaped,'\\')));
  }
  var result=requests.findAll(spec,PageRequest.of(page,30,Sort.by(Sort.Direction.DESC,"id")));
  return new RequestPage(result.getContent().stream().map(r->view(r,u,original)).toList(),result.getTotalElements(),page,result.getTotalPages());
 }
 private List<Person> team(){
  var result=new LinkedHashMap<Long,Person>();
  appointments.findByTermYear(access.activeYear()).stream().filter(a->a.getPosition()==OfficerPosition.INTERCESSION&&eligible(a.getUser())).forEach(a->result.put(a.getUser().getId(),new Person(a.getUser().getId(),a.getUser().getName(),"팀장")));
  members.findAll().stream().filter(m->eligible(m.getUser())).sorted(Comparator.comparing(m->m.getUser().getName())).forEach(m->result.putIfAbsent(m.getId(),new Person(m.getId(),m.getUser().getName(),"팀원")));
  return List.copyOf(result.values());
 }
 public State state(LocalDate requestedWeek,User principal){
  var u=actor(principal);boolean manager=canManage(u),leader=lead(u);var week=monday(requestedWeek);
  int tue=0,thu=0;
  if(!week.isAfter(monday(null))){var counts=participation.get(week).summary();tue=counts.tuesday();thu=counts.thursday();}
  var pending=requests.count((r,q,b)->b.and(b.notEqual(r.get("status"),Status.ARCHIVED),b.or(b.equal(r.get("status"),Status.PENDING),b.isNotNull(r.get("pendingUpdate")))));
  var published=requests.count(publicSpec().and((r,q,b)->b.equal(r.get("status"),Status.PUBLISHED)));
  return new State(u.getId(),manager,leader,canViewTeam(u),week,manager?registry.findById(1L).map(IntercessionRegistry::getRevision).orElse(0L):0,
   canViewTeam(u)?team():List.of(),leader?users.findByIsActiveTrue().stream().filter(this::eligible).sorted(Comparator.comparing(User::getName)).map(p->new Person(p.getId(),p.getName(),p.getRole().name())).toList():List.of(),
   List.of(meetingView(week.plusDays(1),tue,u),meetingView(week.plusDays(3),thu,u)),manager?pending:0,published);
 }
 private IntercessionMeeting meeting(LocalDate date){meetingDate(date);return meetings.findById(date).orElseGet(()->{var m=new IntercessionMeeting();m.setMeetingDate(date);return m;});}
 private MeetingView meetingView(LocalDate date,int voters,User u){
  var m=meeting(date);boolean manager=canManage(u);
  List<Long> ids=read(m.getSelectedIds(),new TypeReference<>(){});
  var available=new HashMap<Long,IntercessionRequest>();requests.findAllById(ids).stream().filter(r->r.isShare()&&r.getStatus()==Status.PUBLISHED).forEach(r->available.put(r.getId(),r));
  List<PaperItem> paper=m.getPaper()==null?List.of():read(m.getPaper(),new TypeReference<>(){});
  boolean stale=paper.stream().anyMatch(p->!available.containsKey(p.id())||available.get(p.id()).getRevision()!=p.revision());
  return new MeetingView(date,IntercessionMeeting.START_TIME,m.getDuration(),m.getHost()==null?null:m.getHost().getId(),m.getHost()==null?"미배정":eligible(m.getHost())&&canManage(m.getHost())?m.getHost().getName():"진행자 재배정 필요",m.getZoomUrl(),m.getRevision(),voters,
   manager?ids.stream().filter(available::containsKey).map(id->view(available.get(id),u,false)).toList():List.of(),manager&&!stale?paper:List.of(),manager&&stale,manager?m.getPreparedAt():null,m.isCanceled(),m.getCancellationReason());
 }
 @Transactional public State members(MemberInput in,User principal){
  var u=writer(principal);if(!lead(u))throw AppException.forbidden("팀장만 팀원을 지정할 수 있습니다.");
  var r=registry.findById(1L).orElseGet(IntercessionRegistry::new);revision(in.revision(),r.getRevision());
  if(in.userIds()==null||in.userIds().size()>100||in.userIds().stream().anyMatch(Objects::isNull))throw AppException.badRequest("팀원을 선택해주세요.");
  var ids=new LinkedHashSet<>(in.userIds());var selected=users.findAllById(ids);
  if(selected.size()!=ids.size()||selected.stream().anyMatch(p->!eligible(p)))throw AppException.badRequest("이용 중인 교사를 선택해주세요.");
  members.findAll().stream().filter(m->!ids.contains(m.getId())).forEach(members::delete);members.flush();
  for(var person:selected)if(!access.hasOffice(person,OfficerPosition.INTERCESSION)&&!members.existsById(person.getId())){var m=new IntercessionMember();m.setUser(person);members.save(m);}
  members.flush();r.setRevision(r.getRevision()+1);registry.saveAndFlush(r);return state(null,u);
 }
 @Transactional public RequestView submit(RequestInput in,User principal){
  var u=writer(principal);if(in.proxy())manage(u);
  if(in.category()==null||!CATEGORIES.contains(in.category()))throw AppException.badRequest("분류를 선택해주세요.");
  var r=new IntercessionRequest();r.setAuthor(u);r.setTitle(text(in.title(),80,true));r.setBody(text(in.body(),2000,true));r.setCategory(in.category());
  r.setSenderName(in.proxy()?text(in.senderName(),80,true):u.getName());r.setSource(in.proxy()?"카톡":"앱");r.setShare(in.share());r.setAnonymous(in.anonymous());
  r.setPublicTitle(r.getTitle());r.setCreatedAt(now());r.setUpdatedAt(now());requests.saveAndFlush(r);return view(r,u,true);
 }
 @Transactional public RequestView review(Long id,ReviewInput in,User principal){
  var u=writer(principal);manage(u);var r=request(id);revision(in.revision(),r.getRevision());
  if(r.getStatus()==Status.ARCHIVED)throw AppException.conflict("삭제된 기도제목입니다.");
  if(r.getPendingUpdate()!=null)throw AppException.conflict("수정 내용과 근황을 먼저 확인해주세요.");
  if(in.action()==null||!Set.of("SAVE","PUBLISH","ANSWER").contains(in.action()))throw AppException.badRequest("처리를 확인해주세요.");
  if(in.action().equals("ANSWER")){
   if(r.getStatus()!=Status.PUBLISHED)throw AppException.badRequest("공유 중인 제목만 응답·감사로 옮길 수 있습니다.");r.setStatus(Status.ANSWERED);r.setPrayerCompleted(true);
  }else{
   if(in.action().equals("PUBLISH")&&!r.isShare())throw AppException.forbidden("팀에만 전달된 내용은 전체 공유할 수 없습니다.");
   r.setPublicTitle(text(in.publicTitle(),80,true));r.setPublicText(text(in.publicText(),2000,true));
   // Anonymous consent may be tightened by a team editor, never loosened.
   if(r.isAnonymous()&&!in.anonymous())throw AppException.forbidden("익명으로 제출된 이름은 공개할 수 없습니다.");
   r.setAnonymous(in.anonymous());r.setStatus(in.action().equals("PUBLISH")?(r.isPrayerCompleted()?Status.ANSWERED:Status.PUBLISHED):Status.READY);
  }
  r.setRevision(r.getRevision()+1);r.setUpdatedAt(now());requests.saveAndFlush(r);return view(r,u,true);
 }
 @Transactional public RequestView decide(Long id,DecisionInput in,User principal){
  var u=writer(principal);manage(u);var r=request(id);revision(in.revision(),r.getRevision());
  if(r.getStatus()==Status.ARCHIVED)throw AppException.conflict("삭제된 기도제목입니다.");
  if(r.getPendingUpdate()!=null)throw AppException.conflict("수정 내용과 근황을 먼저 확인해주세요.");
  if(in.publish()==null||in.completed()==null)throw AppException.badRequest("공유 여부와 기도 상태를 선택해주세요.");
  if(in.publish()&&!r.isShare())throw AppException.forbidden("팀에만 전달된 내용은 전체 공유할 수 없습니다.");
  boolean anonymous=in.anonymous()==null?r.isAnonymous():in.anonymous();
  if(r.isAnonymous()&&!anonymous)throw AppException.forbidden("익명으로 제출된 이름은 공개할 수 없습니다.");
  String title=text(in.publicTitle()==null?(r.getPublicTitle().isBlank()?r.getTitle():r.getPublicTitle()):in.publicTitle(),80,true);
  String body=text(in.publicText()==null?(r.getPublicText().isBlank()?r.getBody():r.getPublicText()):in.publicText(),2000,true);
  r.setPublicTitle(title);r.setPublicText(body);r.setAnonymous(anonymous);r.setPrayerCompleted(in.completed());
  r.setStatus(in.publish()?(in.completed()?Status.ANSWERED:Status.PUBLISHED):Status.READY);
  r.setRevision(r.getRevision()+1);r.setUpdatedAt(now());requests.saveAndFlush(r);return view(r,u,true);
 }
 @Transactional public RequestView updateRequest(Long id,UpdateInput in,User principal){
  var u=writer(principal);var r=request(id);
  if(!owner(r,u))throw AppException.forbidden("본인이 보낸 기도제목만 수정할 수 있습니다.");
  revision(in.revision(),r.getRevision());
  if(r.getStatus()==Status.ARCHIVED)throw AppException.conflict("삭제된 기도제목입니다.");
  String title=text(in.title(),80,true),body=text(in.body(),2000,true),note=text(in.note(),2000,false);
  if(title.equals(r.getTitle())&&body.equals(r.getBody())&&note.isEmpty())throw AppException.badRequest("수정할 내용이나 근황을 입력해주세요.");
  r.setPendingUpdate(write(new PrayerUpdate(title,body,note,now())));
  r.setRevision(r.getRevision()+1);r.setUpdatedAt(now());requests.saveAndFlush(r);return view(r,u,true);
 }
 @Transactional public RequestView reviewUpdate(Long id,UpdateReviewInput in,User principal){
  var u=writer(principal);manage(u);var r=request(id);revision(in.revision(),r.getRevision());
  if(r.getStatus()==Status.ARCHIVED)throw AppException.conflict("삭제된 기도제목입니다.");
  if(r.getPendingUpdate()==null)throw AppException.conflict("확인할 수정 내용이 없습니다.");
  if(in.updatePublic()==null)throw AppException.badRequest("공유 내용에 반영할지 선택해주세요.");
  if(in.updatePublic()&&!r.isShare())throw AppException.forbidden("팀에만 전달된 내용은 전체 공유할 수 없습니다.");
  var update=read(r.getPendingUpdate(),new TypeReference<PrayerUpdate>(){});
  String title=in.updatePublic()?text(in.publicTitle(),80,true):r.getPublicTitle(),body=in.updatePublic()?text(in.publicText(),2000,true):r.getPublicText();
  r.setTitle(update.title());r.setBody(update.body());
  if(in.updatePublic()){
   r.setPublicTitle(title);r.setPublicText(body);
   r.setStatus(r.isPrayerCompleted()?Status.ANSWERED:Status.PUBLISHED);
  }else if(r.getStatus()==Status.PENDING){r.setStatus(Status.READY);}
  var history=new ArrayList<>(read(r.getUpdateHistory(),new TypeReference<List<UpdateHistory>>(){}));
  history.add(new UpdateHistory(update,now(),in.updatePublic()));r.setUpdateHistory(write(history));r.setPendingUpdate(null);
  r.setRevision(r.getRevision()+1);r.setUpdatedAt(now());requests.saveAndFlush(r);return view(r,u,true);
 }
 @Transactional public RequestView withdraw(Long id,Revision in,User principal){
  var u=writer(principal);var r=request(id);if(!owner(r,u)&&!canManage(u))throw AppException.forbidden("작성자 또는 중보기도팀만 삭제할 수 있습니다.");
  revision(in.revision(),r.getRevision());r.setStatus(Status.ARCHIVED);r.setPendingUpdate(null);r.setRevision(r.getRevision()+1);r.setUpdatedAt(now());requests.saveAndFlush(r);return view(r,u,true);
 }
 private String zoom(String value){
  String s=text(value,1000,false);if(s.isEmpty())return s;
  try{var uri=URI.create(s);String host=uri.getHost()==null?"":uri.getHost().toLowerCase(Locale.ROOT);
   if(!"https".equalsIgnoreCase(uri.getScheme())||uri.getUserInfo()!=null||uri.getPort()!=-1||!(host.equals("zoom.us")||host.endsWith(".zoom.us")||host.equals("zoom.com")||host.endsWith(".zoom.com")))throw new IllegalArgumentException();
  }catch(Exception e){throw AppException.badRequest("올바른 Zoom HTTPS 주소를 입력해주세요.");}return s;
 }
 @Transactional public State configure(LocalDate date,MeetingInput in,User principal){
  var u=writer(principal);manage(u);var m=meeting(date);revision(in.revision(),m.getRevision());
  if(!List.of(30,45,60).contains(in.duration()))throw AppException.badRequest("진행 시간은 30·45·60분입니다.");
  User host=null;if(in.hostId()!=null){host=users.findById(in.hostId()).orElseThrow(()->AppException.badRequest("진행자를 선택해주세요."));if(!eligible(host)||!canManage(host))throw AppException.badRequest("현재 중보기도팀에서 진행자를 선택해주세요.");}
  String zoomUrl=zoom(in.zoomUrl());
  String reason=Boolean.TRUE.equals(in.canceled())?text(in.cancellationReason(),120,false):"";
  if(!Set.of("","교회 행사","부서 행사","기타").contains(reason))throw AppException.badRequest("취소 사유를 선택해주세요.");
  m.setHost(host);m.setStartTime(IntercessionMeeting.START_TIME);m.setDuration(in.duration());m.setZoomUrl(zoomUrl);
  // Cancellation is an announcement only: votes, attendance statistics and prepared materials stay intact.
  if(in.canceled()!=null){m.setCanceled(in.canceled());m.setCancellationReason(reason);}
  changed(m);return state(date,u);
 }
 private void changed(IntercessionMeeting m){m.setRevision(m.getRevision()+1);meetings.saveAndFlush(m);}
 @Transactional public State materials(LocalDate date,MaterialsInput in,User principal){
  var u=writer(principal);manage(u);var m=meeting(date);revision(in.revision(),m.getRevision());
  if(in.requestIds()==null||in.requestIds().size()>50||in.requestIds().stream().anyMatch(Objects::isNull)||new HashSet<>(in.requestIds()).size()!=in.requestIds().size())throw AppException.badRequest("기도제목은 중복 없이 50개까지 선택해주세요.");
  var found=requests.findAllById(in.requestIds());
  if(found.size()!=in.requestIds().size()||found.stream().anyMatch(r->!r.isShare()||r.getStatus()!=Status.PUBLISHED))throw AppException.conflict("현재 전체 공유 중인 기도제목만 선택할 수 있습니다.");
  m.setSelectedIds(write(in.requestIds()));m.setPaper(null);m.setPreparedAt(null);changed(m);return state(date,u);
 }
 @Transactional public State prepare(LocalDate date,Revision in,User principal){
  var u=writer(principal);manage(u);var m=meeting(date);revision(in.revision(),m.getRevision());
  List<Long> ids=read(m.getSelectedIds(),new TypeReference<>(){});if(ids.isEmpty())throw AppException.badRequest("기도제목을 먼저 선택해주세요.");
  var result=new ArrayList<PaperItem>();var continuing=new ArrayList<Long>();
  for(var id:ids){var r=request(id);
   if(r.isPrayerCompleted()&&r.getStatus()!=Status.ARCHIVED)continue;
   if(!r.isShare()||r.getStatus()!=Status.PUBLISHED)throw AppException.conflict("공유 내용이 변경됐습니다. 제목을 다시 선택해주세요.");
   continuing.add(id);
   result.add(new PaperItem(id,r.getRevision(),r.getPublicTitle(),r.getPublicText(),r.getCategory(),r.isAnonymous()?null:r.getSenderName()));}
  if(result.isEmpty())throw AppException.badRequest("계속 기도할 제목을 먼저 선택해주세요.");
  m.setSelectedIds(write(continuing));
  m.setPaper(write(result));m.setPreparedAt(now());changed(m);return state(date,u);
 }
}
