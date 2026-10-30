package com.newaveflow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.dto.report.NewFamilyDto.*;
import com.newaveflow.dto.report.WeeklyReportDto.*;
import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;
import static com.newaveflow.service.WeeklyReportSourceService.*;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class NewFamilyService {
    private final NewFamilyMemberRepository members;
    private final NewFamilyCheckRepository checks;
    private final NewFamilySubmissionRepository submissions;
    private final NewFamilyReferenceRepository references;
    private final NewFamilyRegistryRepository registry;
    private final StudentRepository students;
    private final UserRepository users;
    private final ClassGroupRepository classes;
    private final TeacherClassRepository teachers;
    private final WeeklyClassSupplementRepository supplements;
    private final DailyReportRepository reports;
    private final ObjectMapper json;
    private final ClassAccessService classAccess;
    private static final List<String> GRADES=List.of("중1","중2","중3","고1","고2","고3");

    public Handoff handoff(Long studentId,User actor) {
        var u=current(actor);
        var s=students.findById(studentId).orElseThrow(()->AppException.notFound("학생을 찾을 수 없습니다."));
        classAccess.requireStudent(u,s);
        return members.findByStudentId(studentId).filter(m->s.belongsToClassOn(LocalDate.now()))
                .map(m->new Handoff(m.getFirstVisit(),m.getEnrolledOn(),m.getGraduatedOn(),s.getClassEffectiveDate(),m.getHandoffMemo())).orElse(null);
    }

    private User current(User actor) {
        if(actor==null)throw AppException.unauthorized("로그인이 필요합니다.");
        var u=users.findById(actor.getId()).orElseThrow(()->AppException.unauthorized("로그인이 필요합니다."));
        if(!u.isActive()||u.isSuspended())throw AppException.forbidden("사용할 수 없는 계정입니다.");
        return u;
    }
    private boolean admin(User u){return u.getRole()==User.Role.ADMIN||u.getRole()==User.Role.PASTOR;}
    public Capability capability(User actor){var u=current(actor);return new Capability(admin(u)||u.isNewFamilyTeam(),admin(u),admin(u));}
    private User requireTeam(User actor){var u=current(actor);if(!admin(u)&&!u.isNewFamilyTeam())throw AppException.forbidden("새가족팀 담당자만 접근할 수 있습니다.");return u;}
    private User requireAdmin(User actor){var u=current(actor);if(!admin(u))throw AppException.forbidden("관리자 또는 목사님만 확정할 수 있습니다.");return u;}
    private void lock(){var r=registry.lockRegistry().orElseGet(()->registry.saveAndFlush(new NewFamilyRegistry()));r.setChangeNumber(r.getChangeNumber()+1);}
    public List<TeamUser> team(User actor){requireAdmin(actor);return users.findByIsActiveTrue().stream().sorted(Comparator.comparing(User::getName)).map(u->new TeamUser(u.getId(),u.getName(),u.getRole().name(),u.isNewFamilyTeam())).toList();}
    @Transactional public void setTeam(Long id,TeamInput input,User actor){requireAdmin(actor);if(input==null)throw AppException.badRequest("담당 여부를 확인해주세요.");var u=users.lockById(id).orElseThrow(()->AppException.notFound("교사를 찾을 수 없습니다."));if(!u.isActive()||u.isSuspended())throw AppException.badRequest("이용 중인 교사만 지정할 수 있습니다.");u.updateNewFamilyTeam(input.member());}
    public List<Person> roster(User actor){requireTeam(actor);return members.findRoster().stream().map(this::person).toList();}
    private <T>T read(String data,TypeReference<T> type){try{return json.readValue(data,type);}catch(Exception e){throw new IllegalStateException("Invalid new-family data",e);}}
    private String encode(Object value){try{return json.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
    private String hash(Object value){try{return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(encode(value).getBytes(java.nio.charset.StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
    private LocalDate sunday(LocalDate date){return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));}
    private List<LocalDate> course(NewFamilyMember m){return read(m.getCourseJson(),new TypeReference<List<LocalDate>>(){});}
    private Profile profile(Student s,String introducer){return new Profile(s.getName(),s.getGrade(),gender(s.getGender()),Objects.toString(s.getSchool(),""),Objects.toString(s.getPhone(),""),Objects.toString(s.getAddress(),""),introducer);}
    private Person person(NewFamilyMember m){var s=m.getStudent();return new Person(m.getId(),s.getId(),m.getRevision(),profile(s,m.getIntroducer()),m.getFirstVisit(),m.getEnrolledOn(),course(m),m.getMemo(),m.getDecision(),m.getDecisionReason(),m.getDecidedBy(),m.getDecidedAt(),m.getGraduatedOn(),m.isAssignmentRequested(),s.getClassGroup()==null?null:s.getClassGroup().getId(),s.getClassGroup()==null?"":s.getClassGroup().getName(),s.getClassEffectiveDate(),m.getHandoffMemo());}
    private NewFamilyMember member(Long id,long revision){var m=members.findById(id).orElseThrow(()->AppException.notFound("학생을 찾을 수 없습니다."));if(m.getRevision()!=revision)throw AppException.conflict("다른 담당자가 수정했습니다. 최신 자료를 확인해주세요.");return m;}
    private void touch(NewFamilyMember m,User actor){m.setUpdatedAt(LocalDateTime.now());m.setUpdatedBy(actor.getName());members.saveAndFlush(m);}
    private Profile clean(Profile p){if(p==null)throw AppException.badRequest("학생 정보를 확인해주세요.");String name=text(p.name(),50),grade=text(p.grade(),20);if(name.isBlank()||!GRADES.contains(grade))throw AppException.badRequest("이름과 학년을 확인해주세요.");ContentTextFilter.check(name,p.school(),p.address());return new Profile(name,grade,gender(p.gender()),text(p.school(),100),text(p.phone(),20),text(p.address(),255),text(p.introducer(),100));}
    private void apply(Student s,Profile p){s.update(p.name(),p.gender(),s.getBirthDate(),p.school(),p.phone(),s.getBaptism(),s.getFatherName(),s.getFatherPhone(),s.getMotherName(),s.getMotherPhone(),p.address(),s.getProfileImage());s.updateGrade(p.grade());}
    private void date(LocalDate date,LocalDate min){if(date==null||date.isBefore(min)||date.isAfter(LocalDate.now()))throw AppException.badRequest("실제 날짜를 확인해주세요.");}
    @Transactional public Person create(Create input,User actor){var u=requireTeam(actor);lock();if(input==null)throw AppException.badRequest("첫 방문 정보를 입력해주세요.");var p=clean(input.profile());date(input.firstVisit(),LocalDate.of(2000,1,1));
        if(!input.distinctPerson()&&students.findAll().stream().anyMatch(s->s.getName().equals(p.name())&&Objects.equals(s.getGrade(),p.grade())))throw AppException.conflict("같은 이름·학년의 학생이 있습니다. 기존 명단을 확인하고 동명이인인 경우에만 새 기록을 만드세요.");
        var s=Student.builder().name(p.name()).grade(p.grade()).gender(p.gender()).school(p.school()).phone(p.phone()).address(p.address()).build();students.saveAndFlush(s);
        var m=new NewFamilyMember();m.setStudent(s);m.setFirstVisit(input.firstVisit());m.setIntroducer(p.introducer());touch(m,u);return person(m);
    }
    @Transactional public Person edit(Long id,Edit input,User actor){var u=requireTeam(actor);lock();var m=member(id,input.revision());var p=clean(input.profile());if(m.getStudent().getClassGroup()!=null&&!Objects.equals(p.grade(),m.getStudent().getGrade()))throw AppException.badRequest("반 배정 이후 학년은 학생 관리에서 변경해주세요.");apply(m.getStudent(),p);m.setIntroducer(p.introducer());m.setMemo(text(input.memo(),1000));touch(m,u);return person(m);}
    @Transactional public Person enroll(Long id,Enroll input,User actor){var u=requireTeam(actor);lock();var m=member(id,input.revision());if(m.getEnrolledOn()!=null)throw AppException.conflict("이미 등록 결정이 기록되어 있습니다.");date(input.date(),m.getFirstVisit());m.setEnrolledOn(input.date());m.setMemo(text(input.memo(),1000));touch(m,u);return person(m);}
    private void beforeAssignment(NewFamilyMember m){if(m.getStudent().getClassGroup()!=null)throw AppException.conflict("이미 반 배정이 확정되었습니다. 담당 반 인계 이력을 유지합니다.");if(m.getEnrolledOn()==null)throw AppException.badRequest("새가족 등록 결정을 먼저 기록해주세요.");}
    @Transactional public Person saveCourse(Long id,Course input,User actor){var u=requireTeam(actor);lock();var m=member(id,input.revision());beforeAssignment(m);if(input.dates()==null||input.dates().size()!=4)throw AppException.badRequest("4주 과정 참여일을 확인해주세요.");for(var d:input.dates())if(d!=null)date(d,m.getEnrolledOn());m.setCourseJson(encode(input.dates()));m.setMemo(text(input.memo(),1000));touch(m,u);return person(m);}
    @Transactional public Person decide(Long id,Decision input,User actor){var u=requireTeam(actor);lock();var m=member(id,input.revision());beforeAssignment(m);String reason=text(input.reason(),500);if(!Set.of("READY","HOLD").contains(Objects.toString(input.decision(),""))||reason.isBlank())throw AppException.badRequest("팀 판단과 사유를 입력해주세요.");if(input.decision().equals("READY"))date(input.graduatedOn(),m.getEnrolledOn());m.setDecision(input.decision());m.setDecisionReason(reason);m.setDecidedBy(u.getName());m.setDecidedAt(LocalDateTime.now());m.setGraduatedOn(input.decision().equals("READY")?input.graduatedOn():null);m.setAssignmentRequested(false);touch(m,u);return person(m);}
    @Transactional public Person requestAssignment(Long id,Revision input,User actor){var u=requireTeam(actor);lock();var m=member(id,input.revision());beforeAssignment(m);if(!m.getDecision().equals("READY"))throw AppException.badRequest("새가족팀의 등반 가능 판단이 필요합니다.");m.setAssignmentRequested(true);touch(m,u);return person(m);}
    @Transactional public Person assign(Long id,Assign input,User actor){var u=requireAdmin(actor);lock();var m=member(id,input.revision());beforeAssignment(m);if(!m.getDecision().equals("READY")||!m.isAssignmentRequested())throw AppException.badRequest("새가족팀의 판단과 배정 요청이 필요합니다.");var c=classes.lockById(input.classId()).orElseThrow(()->AppException.notFound("반을 찾을 수 없습니다."));if(!WeeklyReportDocumentService.grade(c.getAgeGroup()).equals(m.getStudent().getGrade()))throw AppException.badRequest("학생과 같은 학년의 반을 선택해주세요.");if(input.effectiveDate()==null||input.effectiveDate().isBefore(LocalDate.now())||input.effectiveDate().isBefore(m.getGraduatedOn())||input.effectiveDate().isAfter(LocalDate.now().plusYears(1)))throw AppException.badRequest("오늘 이후의 반 적용일을 선택해주세요.");m.getStudent().admitToClass(c,input.effectiveDate()); if(!input.effectiveDate().isAfter(sunday(LocalDate.now())))reports.findFirstByClassGroupIdAndReportDateOrderByIdAsc(c.getId(),sunday(LocalDate.now())).ifPresent(DailyReport::markDraftChanged);m.setHandoffMemo(text(input.memo(),500));touch(m,u);return person(m);}
    public List<ClassChoice> classChoices(User actor){requireTeam(actor);var assignments=teachers.findAllWithTeacherAndClass();var all=students.findAllByIsActiveTrueOrderByGradeAscNameAsc();return classes.findAllOrderByName().stream().map(c->new ClassChoice(c.getId(),c.getName(),WeeklyReportDocumentService.grade(c.getAgeGroup()),assignments.stream().filter(a->a.isPrimary()&&a.getClassGroup().getId().equals(c.getId())).map(a->a.getTeacher().getName()).findFirst().orElse("담임 미배정"),(int)all.stream().filter(s->s.belongsToClassOn(LocalDate.now())&&s.getClassGroup().getId().equals(c.getId())).count())).toList();}
    private boolean onTeam(NewFamilyMember m,LocalDate d){return m.getStudent().isActive()&&!sunday(m.getFirstVisit()).isAfter(d)&&!m.getStudent().belongsToClassOn(d);}
    public String category(NewFamilyMember m,LocalDate d){return sunday(m.getFirstVisit()).equals(d)?"FIRST":m.getEnrolledOn()!=null&&!m.getEnrolledOn().isAfter(d)?"FAMILY":"FOLLOWUP";}
    private List<StudentRow> liveRows(LocalDate d){var status=checks.findByWorshipDate(d).stream().collect(Collectors.toMap(c->c.getMember().getId(),NewFamilyCheck::getStatus));return members.findRoster().stream().filter(m->onTeam(m,d)).map(m->{var s=m.getStudent();var p=profile(s,m.getIntroducer());return new StudentRow("student:"+s.getId(),s.getId(),p.name(),p.gender(),p.grade(),"새가족팀",category(m,d),status.getOrDefault(m.getId(),"UNKNOWN"),false,p.school(),p.address(),p.phone(),p.introducer(),true);}).toList();}
    private List<Reference> referenceRows(LocalDate date){Map<String,Reference> result=new LinkedHashMap<>();var linked=references.findByReportDate(date);for(var c:classes.findAll()){
        List<Visitor> visitors=new ArrayList<>();supplements.findByClassGroupIdAndReportDate(c.getId(),date).ifPresent(s->visitors.addAll(read(s.getPayload(),new TypeReference<Supplement>(){}).visitors()));
        reports.findFirstByClassGroupIdAndReportDateOrderByIdAsc(c.getId(),date).filter(r->r.getSubmittedData()!=null).ifPresent(r->{for(var s:read(r.getSubmittedData(),new TypeReference<ClassSource>(){}).students())if(s.id().startsWith("visitor:")&&!visitors.stream().anyMatch(v->("visitor:"+v.id()).equals(s.id())))visitors.add(new Visitor(s.id().substring(8),s.name(),s.gender(),s.grade(),s.school(),s.address(),s.phone(),s.introducer(),s.status(),s.teamConfirmed()));});
        for(var v:visitors){var link=linked.stream().filter(l->l.getClassId().equals(c.getId())&&l.getVisitorId().equals(v.id())).findFirst();if(Boolean.FALSE.equals(v.teamConfirmed())||link.isPresent())result.put(c.getId()+":"+v.id(),new Reference(c.getId(),c.getName(),v.id(),v.name(),v.grade(),v.introducer(),v.status(),link.map(l->l.getMember().getId()).orElse(null)));}
        }return List.copyOf(result.values());}
    private String liveHash(LocalDate date){return hash(List.of(date,liveRows(date),referenceRows(date)));}
    public Week week(LocalDate date,User actor){requireTeam(actor);validateDate(date);var rows=liveRows(date);var refs=referenceRows(date);var hash=liveHash(date);var sub=submissions.findById(date).orElse(null);List<String> issues=new ArrayList<>();for(var row:rows)if(row.status().equals("UNKNOWN"))issues.add(row.name()+" 출석 미확인");if(refs.stream().anyMatch(r->r.memberId()==null))issues.add("일반 반의 첫 방문 참고 기록을 학생에 연결해주세요.");var roster=members.findRoster().stream().filter(m->onTeam(m,date)).toList();return new Week(date,hash,sub!=null,sub!=null&&!sub.getSourceHash().equals(hash),sub==null?0:sub.getRevision(),sub==null?"":sub.getSubmittedBy(),sub==null?null:sub.getSubmittedAt(),roster.stream().map(this::person).toList(),roster.stream().map(m->new Check(m.getId(),rows.stream().filter(r->r.studentId().equals(m.getStudent().getId())).findFirst().orElseThrow().status())).toList(),refs,issues);}
    private void checkHash(LocalDate date,String hash){if(!Objects.equals(hash,liveHash(date)))throw AppException.conflict("다른 담당자가 출결 또는 명단을 변경했습니다. 최신 자료를 확인해주세요.");}
    @Transactional public Week saveChecks(LocalDate date,AttendanceInput input,User actor){var u=requireTeam(actor);validateDate(date);lock();checkHash(date,input.sourceHash());if(input.checks()==null||input.checks().size()>1000)throw AppException.badRequest("출결 입력을 확인해주세요.");Set<Long> ids=new HashSet<>();for(var item:input.checks()){if(item==null||!ids.add(item.memberId())||!Set.of("PRESENT","LATE","ABSENT","UNKNOWN").contains(Objects.toString(item.status(),"")))throw AppException.badRequest("학생별 출결을 중복 없이 확인해주세요.");var m=members.findById(item.memberId()).orElseThrow(()->AppException.notFound("학생을 찾을 수 없습니다."));if(!onTeam(m,date))throw AppException.badRequest("해당 주에 새가족팀이 담당하는 학생만 입력할 수 있습니다.");var c=checks.findByMemberIdAndWorshipDate(m.getId(),date).orElseGet(NewFamilyCheck::new);c.setMember(m);c.setWorshipDate(date);c.setStatus(item.status());c.setUpdatedBy(u.getName());c.setUpdatedAt(LocalDateTime.now());checks.save(c);}checks.flush();return week(date,u);}
    @Transactional public Week link(LocalDate date,LinkInput input,User actor){var u=requireTeam(actor);validateDate(date);lock();var ref=referenceRows(date).stream().filter(r->r.classId().equals(input.classId())&&r.visitorId().equals(input.visitorId())).findFirst().orElseThrow(()->AppException.notFound("참고 기록을 찾을 수 없습니다."));var m=members.findById(input.memberId()).orElseThrow(()->AppException.notFound("연결할 학생을 선택해주세요."));if(!onTeam(m,date))throw AppException.badRequest("해당 주 새가족팀 명단의 학생을 선택해주세요.");if(ref.memberId()!=null&&!ref.memberId().equals(m.getId()))throw AppException.conflict("이미 다른 학생에 연결되었습니다. 기존 연결을 확인해주세요.");var r=references.findByReportDateAndClassIdAndVisitorId(date,input.classId(),input.visitorId()).orElseGet(NewFamilyReference::new);r.setReportDate(date);r.setClassId(input.classId());r.setVisitorId(input.visitorId());r.setMember(m);r.setLinkedBy(u.getName());r.setLinkedAt(LocalDateTime.now());references.saveAndFlush(r);return week(date,u);}
    @Transactional public Week submit(LocalDate date,Submit input,User actor){var u=requireTeam(actor);validateDate(date);lock();checkHash(date,input.sourceHash());var week=week(date,u);if(!week.issues().isEmpty())throw AppException.badRequest("미확인 출결과 참고 기록을 확인한 뒤 제출해주세요.");var s=submissions.findById(date).orElseGet(NewFamilySubmission::new);s.setReportDate(date);s.setPayload(encode(liveRows(date)));s.setSourceHash(liveHash(date));s.setRevision(s.getRevision()+1);s.setSubmittedAt(LocalDateTime.now());s.setSubmittedBy(u.getName());submissions.saveAndFlush(s);return week(date,u);}

    /** Frozen team source; drafts remain excluded from final aggregation. */
    public List<ClassSource> reportSources(LocalDate date){var sub=submissions.findById(date).orElse(null);List<StudentRow> rows=sub==null?liveRows(date):read(sub.getPayload(),new TypeReference<List<StudentRow>>(){});if(rows.isEmpty())return List.of();boolean changed=sub!=null&&!sub.getSourceHash().equals(liveHash(date));List<ClassSource> result=new ArrayList<>();for(int i=0;i<GRADES.size();i++){String grade=GRADES.get(i);var group=rows.stream().filter(r->r.grade().equals(grade)).toList();if(group.isEmpty())continue;long followup=group.stream().filter(r->r.category().equals("FOLLOWUP")&&Set.of("PRESENT","LATE").contains(r.status())).count();result.add(new ClassSource(-100L-i,"새가족팀 · "+grade,grade,sub==null?"새가족팀":sub.getSubmittedBy(),sub==null?0:sub.getRevision(),sub!=null,changed,false,sub==null?null:sub.getSubmittedAt(),group,"",""));}return result;}
    public List<Issue> reportIssues(LocalDate date){var issues=new ArrayList<Issue>();if(referenceRows(date).stream().anyMatch(r->r.memberId()==null))issues.add(new Issue("new-family",null,"새가족팀: 일반 반의 첫 방문 참고 기록 연결 필요"));var sub=submissions.findById(date).orElse(null);if(sub!=null&&!sub.getSourceHash().equals(liveHash(date)))issues.add(new Issue("new-family",null,"새가족팀 자료 변경 · 다시 제출해야 합니다."));return issues;}
    public ClassSource reconcile(ClassSource c,LocalDate date){var links=references.findByReportDate(date);var roster=members.findRoster().stream().collect(Collectors.toMap(m->m.getStudent().getId(),m->m));var rows=c.students().stream().filter(s->!(s.id().startsWith("visitor:")&&links.stream().anyMatch(l->l.getClassId().equals(c.classId())&&s.id().equals("visitor:"+l.getVisitorId())))).filter(s->{var m=roster.get(s.studentId());return m==null||m.getStudent().belongsToClassOn(date);}).map(s->{var m=roster.get(s.studentId());if(m==null)return s;boolean first=sunday(m.getFirstVisit()).equals(date);return new StudentRow(s.id(),s.studentId(),s.name(),s.gender(),s.grade(),s.className(),first?"FIRST":"REGULAR",s.status(),m.getStudent().getClassEffectiveDate()!=null&&m.getStudent().getClassEffectiveDate().with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY)).equals(date),s.school(),s.address(),s.phone(),m.getIntroducer(),true);}).toList();return new ClassSource(c.classId(),c.className(),c.grade(),c.teacherName(),c.revision(),c.submitted(),c.changed(),c.legacy(),c.submittedAt(),rows,c.notes(),c.correctionReason());}
    public boolean linkedReference(Long classId,LocalDate date,String visitorId){return references.findByReportDateAndClassIdAndVisitorId(date,classId,visitorId).isPresent();}
}
