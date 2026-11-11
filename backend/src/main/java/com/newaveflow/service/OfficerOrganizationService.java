package com.newaveflow.service;

import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class OfficerOrganizationService {
    private final UserRepository users;
    private final OfficerRegistryRepository registry;
    private final OfficerAppointmentRepository appointments;
    private final OfficerChangeRepository changes;
    private final AccountDeletionRequestRepository deletions;
    private final OfficerAccessService access;
    private final PraiseService praise;
    private final IntercessionService intercession;
    private final WorshipService worship;
    private final jakarta.persistence.EntityManager em;
    public record Office(String code,String label,String group,String grade,Long userId,String name,String state) {}
    public record Person(Long id,String name,String role) {}
    public record Change(Long id,String action,String position,String previousName,String nextName,String actorName,LocalDateTime changedAt) {}
    public record Organization(int year,int activeYear,long revision,boolean canEdit,List<Office> offices,List<Person> candidates,List<Change> history) {}
    public record Capability(int activeYear,boolean canManage,boolean canEditOrganization,boolean canReport,boolean canNewFamily,List<Office> offices,List<String> grades,boolean canPraise,boolean canIntercession,boolean canWorship) {}
    public record Assignment(Long revision,Long userId) {}
    public record Activation(Long revision) {}

    public Capability capability(User actor) {
        var u=access.current(actor); var positions=access.positions(u);
        return new Capability(access.activeYear(),access.common(u),u.getRole()==User.Role.ADMIN,access.canReport(u),access.canViewNewFamily(u),
            positions.stream().map(p->office(p,u)).toList(),positions.stream().map(p->p.grade).filter(Objects::nonNull).toList(),praise.canEnter(u),intercession.canViewTeam(u),worship.canEnter(u));
    }
    private int year(int value) { if(value<2000||value>2100) throw AppException.badRequest("활동연도를 확인해주세요."); return value; }
    private Office office(OfficerPosition p,User u) {
        return new Office(p.name(),p.label,p.group,p.grade,u==null?null:u.getId(),u==null?"":u.getName(),u==null?"VACANT":!u.isActive()||u.isSuspended()?"INACTIVE":u.getRole()==User.Role.TEACHER?"TEACHER":"ASSIGNED");
    }
    private String name(User u) { return u==null?"—":u.getName(); }
    public Organization get(Integer requestedYear,User actor) {
        var u=access.current(actor); if(!access.common(u)) throw AppException.forbidden("임원만 조직도를 확인할 수 있습니다.");
        int active=access.activeYear(), selected=year(requestedYear==null?active:requestedYear);
        var rows=new EnumMap<OfficerPosition,User>(OfficerPosition.class);
        appointments.findByTermYear(selected).forEach(a->{if(a.getUser()!=null) rows.put(a.getPosition(),a.getUser());});
        boolean edit=u.getRole()==User.Role.ADMIN;
        return new Organization(selected,active,registry.findById(1L).map(OfficerRegistry::getRevision).orElse(0L),edit,
            Arrays.stream(OfficerPosition.values()).map(p->office(p,rows.get(p))).toList(),
            edit?users.findByIsActiveTrue().stream().filter(p->!p.isSuspended()&&!deletions.existsByUserId(p.getId())).sorted(Comparator.comparing(User::getName).thenComparing(User::getId)).map(p->new Person(p.getId(),p.getName(),p.getRole().name())).toList():List.of(),
            edit?changes.findTop50ByTermYearOrderByChangedAtDescIdDesc(selected).stream().map(c->new Change(c.getId(),c.getAction(),c.getPosition()==null?"":c.getPosition().label,name(c.getPreviousUser()),name(c.getNextUser()),name(c.getActor()),c.getChangedAt())).toList():List.of());
    }
    // Use the same ordered account locks as role/suspension changes. They also serialize first registry creation.
    private List<User> lock(User actor) {
        Long id=actor.getId(); long authVersion=actor.getAuthVersion(); em.clear();
        var locked=users.lockAllForStatusChange();
        var u=locked.stream().filter(p->p.getId().equals(id)).findFirst().orElseThrow(()->AppException.unauthorized("다시 로그인해주세요."));
        if(!u.isActive()||u.isSuspended()||u.getRole()!=User.Role.ADMIN||u.getAuthVersion()!=authVersion) throw AppException.forbidden("현재 관리자만 직책을 지정할 수 있습니다.");
        return locked;
    }
    private OfficerRegistry revision(Long expected) {
        var r=registry.findById(1L).orElseGet(()->{var fresh=new OfficerRegistry();fresh.setActiveYear(access.activeYear());return fresh;});
        if(expected==null||expected!=r.getRevision()) throw AppException.conflict("조직도가 변경됐습니다. 최신 내용을 확인해주세요.");
        return r;
    }
    private void synchronizeRoles(List<User> locked, int activeYear) {
        var assigned=new HashSet<Long>();
        appointments.findByTermYear(activeYear).forEach(a->{if(a.getUser()!=null) assigned.add(a.getUser().getId());});
        for(var u:locked) {
            if(assigned.contains(u.getId())) { if(u.isActive()&&!u.isSuspended()) u.grantOrganizationExecutive(); }
            else u.releaseOrganizationExecutive();
        }
    }
    private void log(String action,int year,OfficerPosition position,User previous,User next,User actor) {
        var c=new OfficerChange();c.setAction(action);c.setTermYear(year);c.setPosition(position);c.setPreviousUser(previous);c.setNextUser(next);c.setActor(actor);c.setChangedAt(LocalDateTime.now(OfficerAccessService.ZONE));changes.save(c);
    }
    @Transactional public Organization assign(int selectedYear,OfficerPosition position,Assignment input,User actor) {
        year(selectedYear);if(input==null) throw AppException.badRequest("담당자를 선택해주세요.");
        var locked=lock(actor); var r=revision(input.revision());
        var row=appointments.findByTermYear(selectedYear).stream().filter(a->a.getPosition()==position).findFirst().orElseGet(()->{var a=new OfficerAppointment();a.setTermYear(selectedYear);a.setPosition(position);return a;});
        User next=null;
        if(input.userId()!=null) {
            next=locked.stream().filter(u->u.getId().equals(input.userId())).findFirst().orElseThrow(()->AppException.notFound("교사를 찾을 수 없습니다."));
            if(!next.isActive()||next.isSuspended()||deletions.existsByUserId(next.getId())) throw AppException.conflict("이용 중인 계정만 지정할 수 있습니다.");
            if(position==OfficerPosition.PASTOR&&next.getRole()!=User.Role.PASTOR) throw AppException.badRequest("목사 권한 계정을 선택해주세요.");
        }
        var previous=row.getUser();
        if(Objects.equals(previous==null?null:previous.getId(),input.userId())) return get(selectedYear,actor);
        row.setUser(next);appointments.saveAndFlush(row);
        if(selectedYear==r.getActiveYear()) synchronizeRoles(locked,r.getActiveYear());
        var current=locked.stream().filter(u->u.getId().equals(actor.getId())).findFirst().orElseThrow();
        log("ASSIGN",selectedYear,position,previous,next,current);r.setRevision(r.getRevision()+1);registry.saveAndFlush(r);
        return get(selectedYear,current);
    }
    @Transactional public Organization activate(int selectedYear,Activation input,User actor) {
        year(selectedYear);if(input==null) throw AppException.badRequest("활동연도를 확인해주세요.");
        var locked=lock(actor);var r=revision(input.revision());
        if(r.getActiveYear()==selectedYear) return get(selectedYear,actor);
        var selected=appointments.findByTermYear(selectedYear);
        if(selected.stream().noneMatch(a->a.getUser()!=null)) throw AppException.badRequest("활동할 임원을 먼저 지정해주세요.");
        for(var appointment:selected) {
            var member=appointment.getUser();if(member==null) continue;
            if(!member.isActive()||member.isSuspended()||deletions.existsByUserId(member.getId())) throw AppException.conflict(appointment.getPosition().label+" 담당자의 계정 상태를 확인해주세요.");
            if(appointment.getPosition()==OfficerPosition.PASTOR&&member.getRole()!=User.Role.PASTOR) throw AppException.conflict("목사 권한 계정을 다시 지정해주세요.");
        }
        r.setActiveYear(selectedYear);r.setRevision(r.getRevision()+1);registry.saveAndFlush(r);synchronizeRoles(locked,selectedYear);
        var current=locked.stream().filter(u->u.getId().equals(actor.getId())).findFirst().orElseThrow();
        log("ACTIVATE",selectedYear,null,null,null,current);return get(selectedYear,current);
    }
}
