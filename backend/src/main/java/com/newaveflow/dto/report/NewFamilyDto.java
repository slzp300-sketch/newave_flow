package com.newaveflow.dto.report;
import java.time.*;
import java.util.*;
public final class NewFamilyDto {
    private NewFamilyDto() {}
    public record Capability(boolean canManage,boolean canAssign,boolean canManageTeam) {}
    public record TeamUser(Long id,String name,String role,boolean member) {}
    public record TeamInput(boolean member) {}
    public record Profile(String name,String grade,String gender,String school,String phone,String address,String introducer) {}
    public record Create(Profile profile,LocalDate firstVisit,boolean distinctPerson) {}
    public record Edit(long revision,Profile profile,String memo) {}
    public record Enroll(long revision,LocalDate date,String memo) {}
    public record Course(long revision,List<LocalDate> dates,String memo) {}
    public record Decision(long revision,String decision,String reason,LocalDate graduatedOn) {}
    public record Revision(long revision) {}
    public record Assign(long revision,Long classId,LocalDate effectiveDate,String memo) {}
    public record Person(Long id,Long studentId,long revision,Profile profile,LocalDate firstVisit,LocalDate enrolledOn,
                         List<LocalDate> course,String memo,String decision,String decisionReason,String decidedBy,LocalDateTime decidedAt,
                         LocalDate graduatedOn,boolean assignmentRequested,Long classId,String className,LocalDate effectiveDate,String handoffMemo) {}
    public record Check(Long memberId,String status) {}
    public record AttendanceInput(String sourceHash,List<Check> checks) {}
    public record Submit(String sourceHash) {}
    public record LinkInput(Long classId,String visitorId,Long memberId) {}
    public record Reference(Long classId,String className,String visitorId,String name,String grade,String introducer,String status,Long memberId) {}
    public record Week(LocalDate date,String sourceHash,boolean submitted,boolean changed,long revision,String submittedBy,LocalDateTime submittedAt,
                       List<Person> people,List<Check> checks,List<Reference> references,List<String> issues) {}
    public record ClassChoice(Long id,String name,String grade,String teacher,int size) {}
    public record Handoff(LocalDate firstVisit,LocalDate enrolledOn,LocalDate graduatedOn,LocalDate effectiveDate,String memo) {}
}
