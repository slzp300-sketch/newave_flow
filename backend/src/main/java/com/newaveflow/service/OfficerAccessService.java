package com.newaveflow.service;
import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

@Service("officerAccess") @RequiredArgsConstructor @Transactional(readOnly=true)
public class OfficerAccessService {
    private final UserRepository users;
    private final OfficerRegistryRepository registry;
    private final OfficerAppointmentRepository appointments;
    public static final ZoneId ZONE=ZoneId.of("Asia/Seoul");
    public int activeYear() { return registry.findById(1L).map(OfficerRegistry::getActiveYear).orElse(LocalDate.now(ZONE).getYear()); }
    public User current(User actor) {
        if(actor==null) throw AppException.unauthorized("로그인이 필요합니다.");
        var u=users.findById(actor.getId()).orElseThrow(()->AppException.unauthorized("로그인이 필요합니다."));
        if(!u.isActive()||u.isSuspended()) throw AppException.forbidden("사용할 수 없는 계정입니다.");
        return u;
    }
    public boolean common(User u) { return u!=null&&u.isActive()&&!u.isSuspended()&&u.getRole()!=User.Role.TEACHER; }
    public boolean all(User u) { return common(u)&&(u.getRole()==User.Role.ADMIN||u.getRole()==User.Role.PASTOR); }
    public boolean hasOffice(User u,OfficerPosition position) {
        return common(u)&&appointments.existsByTermYearAndPositionAndUserId(activeYear(),position,u.getId());
    }
    public List<OfficerPosition> positions(User u) {
        if(!common(u)) return List.of();
        return appointments.findByTermYear(activeYear()).stream().filter(a->a.getUser()!=null&&a.getUser().getId().equals(u.getId())).map(OfficerAppointment::getPosition).sorted().toList();
    }
    public boolean canReport(User actor) { var u=current(actor); return all(u)||hasOffice(u,OfficerPosition.SECRETARY); }
    public boolean canNewFamily(User actor) { var u=current(actor); return all(u)||u.isNewFamilyTeam()||hasOffice(u,OfficerPosition.NEW_FAMILY); }
    public boolean canViewNewFamily(User actor) { var u=current(actor); return common(u)||canNewFamily(u); }
}
