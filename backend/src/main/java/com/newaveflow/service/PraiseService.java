package com.newaveflow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.apache.pdfbox.Loader;
import java.time.*;
import java.util.*;
import java.net.URI;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class PraiseService {
 private final PraiseTermRepository terms;
 private final PraiseMemberRepository members;
 private final PraiseWeekRepository weeks;
 private final PraiseResponseRepository responses;
 private final PraisePrayerRepository prayers;
 private final PraisePdfRepository pdfs;
 private final UserRepository users;
 private final StudentRepository students;
 private final AccountDeletionRequestRepository deletions;
 private final OfficerAccessService access;
 private final ObjectMapper json;
 private final Clock clock;
 public static final List<String> PARTS=List.of("인도자","메인","세컨","일렉","베이스","드럼","싱어","워십");
 public record TermInput(int year,int half) {}
 public record MemberInput(Long revision,Long id,Long userId,Long studentId,List<String> parts,boolean active) {}
 public record BulkMembersInput(Long revision,List<MemberInput> members) {}
 public record MonthInput(Long revision,String month) {}
 public record WeekInput(Long revision,LocalDate practiceDate,LocalTime startTime,LocalTime endTime,Map<String,List<Long>> slots,boolean acceptUnavailable) {}
 public record ResponseInput(Long revision,String month,List<LocalDate> dates,Map<String,Long> scheduleVersions) {}
 public record PrayerInput(Long revision,LocalDate date,Long hostId,String zoomUrl) {}
 public record TermView(Long id,int year,int half,long revision) {}
 public record MemberView(Long id,Long userId,Long studentId,String name,String kind,String grade,List<String> parts,boolean active) {}
 public record Candidate(Long userId,Long studentId,String name,String kind,String grade) {}
 public record WeekView(Long id,LocalDate worshipDate,LocalDate practiceDate,LocalTime startTime,LocalTime endTime,long scheduleVersion,Map<String,List<Long>> slots,boolean published,boolean draftChanged,LocalDateTime publishedAt,LocalDateTime updatedAt,List<PraisePdfRepository.Metadata> pdfs,boolean canUpload) {}
 public record ResponseView(Long userId,String month,List<LocalDate> dates,Map<String,Long> scheduleVersions,LocalDateTime submittedAt) {}
 public record PrayerView(Long id,LocalDate date,Long hostId,String zoomUrl) {}
 public record State(boolean canManage,boolean canViewAll,Long me,List<TermView> terms,TermView term,List<MemberView> members,List<Candidate> candidates,List<WeekView> weeks,List<ResponseView> responses,List<PrayerView> prayers) {}
 private User actor(User u){var current=access.current(u);if(deletions.existsByUserId(current.getId()))throw AppException.forbidden("탈퇴 처리 중인 계정입니다.");return current;}
 public boolean manager(User u){return access.all(u)||access.hasOffice(u,OfficerPosition.PRAISE);}
 public boolean canEnter(User u){u=access.current(u);if(deletions.existsByUserId(u.getId()))return false;return access.common(u)||members.existsByUserIdAndActiveTrue(u.getId());}
 private void manage(User u){if(!manager(u))throw AppException.forbidden("찬양팀장만 변경할 수 있습니다.");}
 private boolean active(PraiseMember m){return m.isActive()&&(m.getUser()!=null?m.getUser().isActive()&&!m.getUser().isSuspended()&&!deletions.existsByUserId(m.getUser().getId()):m.getStudent()!=null&&m.getStudent().isActive());}
 private boolean joined(Long term,User u){return members.findByTermIdOrderById(term).stream().anyMatch(m->active(m)&&m.getUser()!=null&&m.getUser().getId().equals(u.getId()));}
 private PraiseTerm term(Long id,User u){var t=terms.findById(id).orElseThrow(()->AppException.notFound("학기를 찾을 수 없습니다."));if(!access.common(u)&&!joined(id,u))throw AppException.forbidden("이 학기 찬양팀원만 이용할 수 있습니다.");return t;}
 private PraiseTerm lock(Long id,Long revision,User u){var t=terms.lockById(id).orElseThrow(()->AppException.notFound("학기를 찾을 수 없습니다."));term(id,u);if(revision==null||revision!=t.getRevision())throw AppException.conflict("내용이 변경됐습니다. 새로고침 후 다시 저장해주세요.");return t;}
 private void changed(PraiseTerm t){t.setRevision(t.getRevision()+1);terms.saveAndFlush(t);}
 private LocalDateTime now(){return LocalDateTime.now(clock);}
 private TermView view(PraiseTerm t){return new TermView(t.getId(),t.getTermYear(),t.getHalf(),t.getRevision());}
 private <T>T read(String value,TypeReference<T> type){try{return json.readValue(value,type);}catch(Exception e){throw new IllegalStateException("Invalid stored praise data",e);}}
 private String write(Object value){try{return json.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
 private Map<String,List<Long>> slots(String value){return value==null?Map.of():read(value,new TypeReference<>(){});}
 private List<String> parts(PraiseMember m){return read(m.getParts(),new TypeReference<>(){});}
 private MemberView view(PraiseMember m){var u=m.getUser();var s=m.getStudent();return new MemberView(m.getId(),u==null?null:u.getId(),s==null?null:s.getId(),u!=null?u.getName():s!=null?s.getName():"삭제된 팀원",u!=null?"교사":"학생",s==null?null:s.getGrade(),parts(m),active(m));}
 private ResponseView view(PraiseResponse r){return new ResponseView(r.getUser().getId(),r.getMonth(),read(r.getDates(),new TypeReference<>(){}),read(r.getScheduleVersions(),new TypeReference<>(){}),r.getSubmittedAt());}
 private boolean canUpload(PraiseWeek w,User u){if(manager(u))return true;return slots(w.getPublishedSlots()).getOrDefault("인도자",List.of()).stream().anyMatch(id->members.findById(id).filter(m->active(m)&&m.getUser()!=null&&m.getUser().getId().equals(u.getId())).isPresent());}
 public State state(Long selected,User principal){
  var u=actor(principal);boolean manage=manager(u),viewAll=access.common(u);
  var available=terms.findAllByOrderByTermYearDescHalfDesc().stream().filter(t->viewAll||joined(t.getId(),u)).toList();
  var today=LocalDate.now(clock);int currentHalf=today.getMonthValue()<=7?1:2;
  PraiseTerm t=selected==null?available.stream().filter(v->v.getTermYear()==today.getYear()&&v.getHalf()==currentHalf).findFirst().orElse(available.isEmpty()?null:available.get(0)):term(selected,u);
  var candidates=new ArrayList<Candidate>();
  if(manage){users.findByIsActiveTrue().stream().filter(p->!p.isSuspended()&&!deletions.existsByUserId(p.getId())).forEach(p->candidates.add(new Candidate(p.getId(),null,p.getName(),"교사",null)));students.findAllByIsActiveTrueOrderByGradeAscNameAsc().forEach(s->candidates.add(new Candidate(null,s.getId(),s.getName(),"학생",s.getGrade())));}
  if(t==null)return new State(manage,viewAll,u.getId(),available.stream().map(this::view).toList(),null,List.of(),candidates,List.of(),List.of(),List.of());
  var metadata=pdfs.metadata(t.getId());
  return new State(manage,viewAll,u.getId(),available.stream().map(this::view).toList(),view(t),members.findByTermIdOrderById(t.getId()).stream().map(this::view).toList(),candidates,
   weeks.findByTermIdOrderByWorshipDate(t.getId()).stream().map(w->new WeekView(w.getId(),w.getWorshipDate(),w.getPracticeDate(),w.getStartTime(),w.getEndTime(),w.getScheduleVersion(),slots(manage?w.getSlots():w.getPublishedSlots()),w.getPublishedSlots()!=null,manage&&!Objects.equals(w.getSlots(),w.getPublishedSlots()),w.getPublishedAt(),w.getUpdatedAt(),w.getPublishedSlots()!=null||manage?metadata.stream().filter(p->p.weekId().equals(w.getId())).toList():List.of(),canUpload(w,u))).toList(),
   responses.findByTermId(t.getId()).stream().filter(r->viewAll||r.getUser().getId().equals(u.getId())).map(this::view).toList(),
   prayers.findByTermIdOrderByMeetingDate(t.getId()).stream().map(p->new PrayerView(p.getId(),p.getMeetingDate(),p.getHost()==null?null:p.getHost().getId(),p.getZoomUrl())).toList());
 }
 @Transactional public State create(TermInput in,User principal){var u=actor(principal);manage(u);if(in.year()<2000||in.year()>2100||in.half()<1||in.half()>2)throw AppException.badRequest("학기를 확인해주세요.");var t=terms.findByTermYearAndHalf(in.year(),in.half()).orElseGet(()->{var n=new PraiseTerm();n.setTermYear(in.year());n.setHalf(in.half());return terms.saveAndFlush(n);});return state(t.getId(),u);}
 @Transactional public State member(Long id,MemberInput in,User principal){
  var u=actor(principal);manage(u);var t=lock(id,in.revision(),u);
  upsertMember(t,in);changed(t);return state(id,u);
 }
 @Transactional public State members(Long id,BulkMembersInput in,User principal){var u=actor(principal);manage(u);var t=lock(id,in.revision(),u);if(in.members()==null||in.members().isEmpty()||in.members().size()>100)throw AppException.badRequest("추가할 팀원을 선택해주세요.");for(var member:in.members()){if(member.id()!=null)throw AppException.badRequest("새 팀원만 일괄 지정할 수 있습니다.");upsertMember(t,member);}changed(t);return state(id,u);}
 private void upsertMember(PraiseTerm t,MemberInput in){
  Long id=t.getId();
  if(in.parts()==null||in.parts().isEmpty()||!PARTS.containsAll(in.parts())||in.parts().size()>8)throw AppException.badRequest("담당 파트를 선택해주세요.");
  PraiseMember m;
  if(in.id()!=null){m=members.findById(in.id()).filter(p->p.getTerm().getId().equals(id)).orElseThrow(()->AppException.notFound("팀원을 찾을 수 없습니다."));}
  else{
   if((in.userId()==null)==(in.studentId()==null))throw AppException.badRequest("교사 또는 학생 한 명을 선택해주세요.");
   boolean duplicate=members.findByTermIdOrderById(id).stream().anyMatch(p->p.getUser()!=null&&Objects.equals(p.getUser().getId(),in.userId())||p.getStudent()!=null&&Objects.equals(p.getStudent().getId(),in.studentId()));
   if(duplicate)throw AppException.conflict("이미 지정된 팀원입니다. 기존 항목을 수정해주세요.");
   m=new PraiseMember();m.setTerm(t);
   if(in.userId()!=null)m.setUser(users.findById(in.userId()).filter(p->p.isActive()&&!p.isSuspended()&&!deletions.existsByUserId(p.getId())).orElseThrow(()->AppException.badRequest("사용 중인 교사를 선택해주세요.")));
   else m.setStudent(students.findById(in.studentId()).filter(Student::isActive).orElseThrow(()->AppException.badRequest("재적 학생을 선택해주세요.")));
  }
  m.setParts(write(in.parts().stream().distinct().toList()));m.setActive(in.active());members.saveAndFlush(m);
 }
 private YearMonth month(PraiseTerm t,String input){try{var m=YearMonth.parse(input);if(m.getYear()!=t.getTermYear()||!allowed(t,m.getMonthValue()))throw new IllegalArgumentException();return m;}catch(Exception e){throw AppException.badRequest("학기 안의 월을 선택해주세요.");}}
 private boolean allowed(PraiseTerm t,int month){return t.getHalf()==1?month>=2&&month<=7:month>=9&&month<=12;}
 private void date(PraiseTerm t,LocalDate d){if(d==null||d.getYear()!=t.getTermYear()||!allowed(t,d.getMonthValue()))throw AppException.badRequest("학기 안의 날짜를 선택해주세요.");}
 @Transactional public State generate(Long id,MonthInput in,User principal){
  var u=actor(principal);manage(u);var t=lock(id,in.revision(),u);var m=month(t,in.month());var existing=weeks.findByTermIdOrderByWorshipDate(id);
  for(var day=m.atDay(1);day.getMonth()==m.getMonth();day=day.plusDays(1))if(day.getDayOfWeek()==DayOfWeek.SATURDAY){var worship=day.plusDays(1);if(existing.stream().noneMatch(w->w.getWorshipDate().equals(worship))){var w=new PraiseWeek();w.setTerm(t);w.setWorshipDate(worship);w.setPracticeDate(day);w.setUpdatedAt(now());weeks.save(w);}}
  weeks.flush();changed(t);return state(id,u);
 }
 private PraiseWeek week(Long term,Long id){return weeks.findById(id).filter(w->w.getTerm().getId().equals(term)).orElseThrow(()->AppException.notFound("주차를 찾을 수 없습니다."));}
 private boolean unavailable(Long term,PraiseMember m,LocalDate d){if(m.getUser()==null)return false;return responses.findByTermId(term).stream().filter(r->r.getUser().getId().equals(m.getUser().getId())).map(this::view).anyMatch(r->r.dates().contains(d));}
 @Transactional public State week(Long id,Long wid,WeekInput in,User principal){
  var u=actor(principal);manage(u);var t=lock(id,in.revision(),u);var w=week(id,wid);date(t,w.getWorshipDate().minusDays(1));
  if(in.practiceDate()==null||!List.of(w.getWorshipDate().minusDays(1),w.getWorshipDate()).contains(in.practiceDate())||in.startTime()==null||in.endTime()==null||!in.endTime().isAfter(in.startTime()))throw AppException.badRequest("연습 날짜와 시작·종료 시간을 확인해주세요.");
  var roster=members.findByTermIdOrderById(id);if(in.slots()==null||!PARTS.containsAll(in.slots().keySet()))throw AppException.badRequest("배정할 파트를 확인해주세요.");
  for(var entry:in.slots().entrySet()){
   if(entry.getValue()==null||entry.getValue().size()>100||entry.getKey().equals("인도자")&&entry.getValue().size()>1||new HashSet<>(entry.getValue()).size()!=entry.getValue().size())throw AppException.badRequest("배정 인원을 확인해주세요.");
   for(var mid:entry.getValue()){var member=roster.stream().filter(p->p.getId().equals(mid)&&active(p)).findFirst().orElseThrow(()->AppException.badRequest("활동 중인 팀원만 배정할 수 있습니다."));if(unavailable(id,member,in.practiceDate())&&!in.acceptUnavailable())throw AppException.conflict("참여 불가 팀원의 배정을 확인해주세요.");}
  }
  if(!w.getPracticeDate().equals(in.practiceDate())||!w.getStartTime().equals(in.startTime())||!w.getEndTime().equals(in.endTime()))w.setScheduleVersion(w.getScheduleVersion()+1);
  w.setPracticeDate(in.practiceDate());w.setStartTime(in.startTime());w.setEndTime(in.endTime());w.setSlots(write(in.slots()));w.setUpdatedAt(now());weeks.saveAndFlush(w);changed(t);return state(id,u);
 }
 @Transactional public State publish(Long id,MonthInput in,User principal){
  var u=actor(principal);manage(u);var t=lock(id,in.revision(),u);var m=month(t,in.month());var rows=weeks.findByTermIdOrderByWorshipDate(id).stream().filter(w->YearMonth.from(w.getWorshipDate().minusDays(1)).equals(m)).toList();
  if(rows.isEmpty())throw AppException.badRequest("먼저 월간 일정을 만들어주세요.");
  var roster=members.findByTermIdOrderById(id);
  for(var w:rows){var all=slots(w.getSlots());if(all.getOrDefault("인도자",List.of()).isEmpty())throw AppException.badRequest("각 주의 인도자를 먼저 배정해주세요.");for(var mid:all.values().stream().flatMap(List::stream).toList())if(roster.stream().noneMatch(p->p.getId().equals(mid)&&active(p)))throw AppException.conflict("활동이 종료된 팀원의 배정을 수정해주세요.");w.setPublishedSlots(w.getSlots());w.setPublishedAt(now());}
  weeks.flush();changed(t);return state(id,u);
 }
 @Transactional public State respond(Long id,ResponseInput in,User principal){
  var u=actor(principal);if(!manager(u)&&!joined(id,u))throw AppException.forbidden("찬양팀원만 불가 일정을 제출할 수 있습니다.");var t=lock(id,in.revision(),u);var m=month(t,in.month());if(!m.equals(YearMonth.now(clock).plusMonths(1)))throw AppException.badRequest("다음 달 일정만 제출할 수 있습니다.");
  if(in.dates()==null||in.dates().size()>5||in.scheduleVersions()==null)throw AppException.badRequest("날짜를 확인해주세요.");
  for(var d:in.dates())if(d==null||!YearMonth.from(d).equals(m)||d.getDayOfWeek()!=DayOfWeek.SATURDAY)throw AppException.badRequest("해당 월의 토요일을 선택해주세요.");
  var current=new LinkedHashMap<String,Long>();weeks.findByTermIdOrderByWorshipDate(id).stream().filter(w->YearMonth.from(w.getWorshipDate().minusDays(1)).equals(m)).forEach(w->current.put(w.getId().toString(),w.getScheduleVersion()));
  if(!current.equals(in.scheduleVersions()))throw AppException.conflict("연습 시간이 변경됐습니다. 확인 후 다시 제출해주세요.");
  var r=responses.findByTermId(id).stream().filter(p->p.getUser().getId().equals(u.getId())&&p.getMonth().equals(in.month())).findFirst().orElseGet(PraiseResponse::new);
  r.setTerm(t);r.setUser(u);r.setMonth(in.month());r.setDates(write(in.dates().stream().distinct().sorted().toList()));r.setScheduleVersions(write(current));r.setSubmittedAt(now());responses.saveAndFlush(r);changed(t);return state(id,u);
 }
 @Transactional public State prayer(Long id,PrayerInput in,User principal){
  var u=actor(principal);var t=lock(id,in.revision(),u);date(t,in.date());if(in.date().getDayOfWeek()!=DayOfWeek.THURSDAY)throw AppException.badRequest("목요일을 선택해주세요.");
  var row=prayers.findByTermIdOrderByMeetingDate(id).stream().filter(p->p.getMeetingDate().equals(in.date())).findFirst().orElseGet(PraisePrayer::new);
  if(!manager(u)&&(row.getHost()==null||row.getHost().getUser()==null||!row.getHost().getUser().getId().equals(u.getId())||!Objects.equals(in.hostId(),row.getHost().getId())))throw AppException.forbidden("팀장 또는 해당 진행자만 수정할 수 있습니다.");
  var host=in.hostId()==null?null:members.findById(in.hostId()).filter(p->p.getTerm().getId().equals(id)&&active(p)&&p.getUser()!=null).orElseThrow(()->AppException.badRequest("활동 중인 교사를 선택해주세요."));
  String url=in.zoomUrl()==null?"":in.zoomUrl().trim();if(!url.isEmpty()){try{var uri=URI.create(url);var hostName=uri.getHost();if(url.length()>1000||!"https".equalsIgnoreCase(uri.getScheme())||uri.getUserInfo()!=null||hostName==null||!(hostName.equals("zoom.us")||hostName.endsWith(".zoom.us"))||uri.getPort()!=-1)throw new IllegalArgumentException();}catch(Exception e){throw AppException.badRequest("https://로 시작하는 Zoom 링크를 입력해주세요.");}}
  row.setTerm(t);row.setMeetingDate(in.date());row.setHost(host);row.setZoomUrl(url);prayers.saveAndFlush(row);changed(t);return state(id,u);
 }
 @Transactional public State upload(Long id,Long wid,Long revision,MultipartFile file,User principal){
  var u=actor(principal);var t=lock(id,revision,u);var w=week(id,wid);if(!canUpload(w,u))throw AppException.forbidden("팀장 또는 이 주의 교사 인도자만 공유할 수 있습니다.");
  if(file==null||file.isEmpty()||file.getSize()>5*1024*1024)throw AppException.badRequest("5MB 이하 PDF를 선택해주세요.");
  byte[] bytes;int pages;try{bytes=file.getBytes();if(bytes.length<5||!new String(bytes,0,5,java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-"))throw new IllegalArgumentException();try(var doc=Loader.loadPDF(bytes)){if(doc.isEncrypted()||doc.getNumberOfPages()<1||doc.getNumberOfPages()>200)throw new IllegalArgumentException();pages=doc.getNumberOfPages();inspectPdf(doc.getDocumentCatalog().getCOSObject(),Collections.newSetFromMap(new IdentityHashMap<>()),0);}}
  catch(Exception e){throw AppException.badRequest("암호·첨부·실행 동작 없는 PDF를 선택해주세요.");}
  var p=new PraisePdf();p.setWeek(w);p.setFileVersion(pdfs.metadata(id).stream().filter(v->v.weekId().equals(wid)).mapToInt(PraisePdfRepository.Metadata::version).max().orElse(0)+1);p.setContent(bytes);p.setPageCount(pages);p.setUploadedBy(u);p.setUploadedAt(now());pdfs.saveAndFlush(p);changed(t);return state(id,u);
 }
 private void inspectPdf(org.apache.pdfbox.cos.COSBase node,Set<org.apache.pdfbox.cos.COSBase> seen,int depth){
  if(node==null||!seen.add(node))return;if(depth>100)throw new IllegalArgumentException();
  if(node instanceof org.apache.pdfbox.cos.COSObject o)inspectPdf(o.getObject(),seen,depth+1);
  if(node instanceof org.apache.pdfbox.cos.COSDictionary d)for(var key:d.keySet()){if(Set.of("JS","JavaScript","OpenAction","AA","EmbeddedFiles","RichMediaContent","Launch").contains(key.getName()))throw new IllegalArgumentException();var value=d.getItem(key);if(key.getName().equals("S")&&value instanceof org.apache.pdfbox.cos.COSName n&&Set.of("JavaScript","Launch","GoToR","SubmitForm","ImportData").contains(n.getName()))throw new IllegalArgumentException();inspectPdf(value,seen,depth+1);}
  if(node instanceof org.apache.pdfbox.cos.COSArray a)for(var value:a)inspectPdf(value,seen,depth+1);
 }
 public PraisePdf download(Long id,User principal){var u=actor(principal);var p=pdfs.findById(id).orElseThrow(()->AppException.notFound("콘티를 찾을 수 없습니다."));term(p.getWeek().getTerm().getId(),u);if(!manager(u)&&p.getWeek().getPublishedSlots()==null)throw AppException.forbidden("공개된 주차의 콘티만 볼 수 있습니다.");return p;}
 public byte[] page(Long id,int index,User principal){var p=download(id,principal);if(index<0||index>=p.getPageCount())throw AppException.badRequest("페이지를 확인해주세요.");try(var doc=Loader.loadPDF(p.getContent());var output=new java.io.ByteArrayOutputStream()){var box=doc.getPage(index).getCropBox();float scale=Math.min(1.5f,Math.min(1400f/Math.max(1,box.getWidth()),1800f/Math.max(1,box.getHeight())));var renderer=new org.apache.pdfbox.rendering.PDFRenderer(doc);renderer.setSubsamplingAllowed(true);var image=renderer.renderImage(index,scale,org.apache.pdfbox.rendering.ImageType.RGB);javax.imageio.ImageIO.write(image,"png",output);image.flush();return output.toByteArray();}catch(java.io.IOException ex){throw AppException.badRequest("PDF 미리보기를 만들지 못했습니다. 원본 파일을 받아주세요.");}}
}
