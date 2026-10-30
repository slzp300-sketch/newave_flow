package com.newaveflow.dto.report;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Values in a submitted source are snapshots, not live roster references. */
public final class WeeklyReportDto {
    private WeeklyReportDto() {}
    public record Member(Long studentId, String category, boolean graduated, String gender,
                         String school, String address, String phone, String introducer, boolean profileLinked) {
        public Member(Long studentId,String category,boolean graduated,String gender,String school,String address,String phone,String introducer) {
            this(studentId,category,graduated,gender,school,address,phone,introducer,false);
        }
    }
    public record Visitor(String id, String name, String gender, String grade, String school,
                          String address, String phone, String introducer, String status, Boolean teamConfirmed) {
        public Visitor(String id,String name,String gender,String grade,String school,String address,String phone,String introducer,String status) {
            this(id,name,gender,grade,school,address,phone,introducer,status,null);
        }
    }
    public record Supplement(List<Member> members, List<Visitor> visitors, String notes) {}
    public record StudentRow(String id, Long studentId, String name, String gender, String grade,
                             String className, String category, String status, boolean graduated,
                             String school, String address, String phone, String introducer, Boolean teamConfirmed) {
        public StudentRow(String id,Long studentId,String name,String gender,String grade,String className,String category,String status,boolean graduated,String school,String address,String phone,String introducer) {
            this(id,studentId,name,gender,grade,className,category,status,graduated,school,address,phone,introducer,null);
        }
    }
    public record ClassSource(Long classId, String className, String grade, String teacherName,
                              long revision, boolean submitted, boolean changed, boolean legacy,
                              LocalDateTime submittedAt, List<StudentRow> students, String notes, String correctionReason) {}
    public record ClassEditor(Long classId, String className, String grade, LocalDate date,
                              Supplement supplement, List<StudentRow> students, String sourceHash) {}
    public record TeacherRow(Long id, String name, String gender, String status, long revision,
                             LocalDateTime updatedAt, String correctionReason) {}
    public record WorshipInput(String gender, String status, String reason) {}
    public record DraftInput(Long revision, Map<String,String> fields) {}
    public record CorrectionInput(Supplement supplement, Map<String,String> attendance, String reason, String sourceHash) {}
    public record Issue(String area, Long targetId, String message) {}
    public record ExportRequest(String sourceHash, long draftRevision) {}
    public record ExportView(Long id, LocalDateTime createdAt, String createdBy) {}
    public record Report(LocalDate date, long draftRevision, String sourceHash,
                         Map<String,String> fields, List<ClassSource> classes, List<TeacherRow> teachers,
                         List<Issue> issues, List<ExportView> exports) {}
}
