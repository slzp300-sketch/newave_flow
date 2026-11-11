package com.newaveflow.controller;
import com.newaveflow.dto.report.WeeklyReportDto.*;
import com.newaveflow.entity.User;
import com.newaveflow.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

@RestController @RequestMapping("/api/weekly-reports") @RequiredArgsConstructor
public class WeeklyReportController {
    private final WeeklyReportService service;
    private final WeeklyReportSourceService sources;
    private final WeeklyReportDocumentService documents;
    @GetMapping("/my-worship") public TeacherRow mine(@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date,@AuthenticationPrincipal User user){return service.myWorship(date,user);}
    @PutMapping("/my-worship") public TeacherRow saveMine(@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date,@RequestBody WorshipInput input,@AuthenticationPrincipal User user){return service.saveWorship(date,user.getId(),input,user);}
    @GetMapping("/classes/{id}") public ClassEditor editor(@PathVariable Long id,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date,@AuthenticationPrincipal User user){return sources.editor(id,date,user);}
    @PutMapping("/classes/{id}") public Supplement save(@PathVariable Long id,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date,@RequestBody Supplement input,@AuthenticationPrincipal User user){return sources.saveTeacherSupplement(id,date,input,user);}
    public record AttendanceSummary(LocalDate date,java.util.List<ClassSource> classes,java.util.List<TeacherRow> teachers) {}
    @GetMapping("/{date}/attendance") @PreAuthorize("hasAnyRole('ADMIN','PASTOR','EXECUTIVE')") public AttendanceSummary attendance(@PathVariable @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date){var r=service.get(date);return new AttendanceSummary(r.date(),r.classes(),r.teachers());}
    @GetMapping("/{date}") @PreAuthorize("@officerAccess.canReport(principal)") public Report report(@PathVariable @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date){return service.get(date);}
    @PutMapping("/{date}") @PreAuthorize("@officerAccess.canReport(principal)") public Report saveDraft(@PathVariable @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date,@RequestBody DraftInput input){return service.saveDraft(date,input);}
    @PutMapping("/{date}/classes/{id}/correction") @PreAuthorize("hasAnyRole('ADMIN','PASTOR','EXECUTIVE')") public AttendanceSummary correct(@PathVariable @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date,@PathVariable Long id,@RequestBody CorrectionInput input,@AuthenticationPrincipal User user){var r=service.correctClass(id,date,input,user);return new AttendanceSummary(r.date(),r.classes(),r.teachers());}
    @PutMapping("/{date}/teachers/{id}") @PreAuthorize("hasAnyRole('ADMIN','PASTOR','EXECUTIVE')") public TeacherRow teacher(@PathVariable @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date,@PathVariable Long id,@RequestBody WorshipInput input,@AuthenticationPrincipal User user){return service.saveWorship(date,id,input,user);}
    @GetMapping(value="/{date}/preview",produces="text/html;charset=UTF-8") @PreAuthorize("@officerAccess.canReport(principal)") public ResponseEntity<String> preview(@PathVariable @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(documents.html(service.get(date)));}
    @PostMapping("/{date}/exports") @PreAuthorize("@officerAccess.canReport(principal)") public ExportView prepare(@PathVariable @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date,@RequestBody ExportRequest input,@AuthenticationPrincipal User user){return service.prepare(date,input,user);}
    @GetMapping("/exports/{id}/{format}") @PreAuthorize("@officerAccess.canReport(principal)") public ResponseEntity<byte[]> download(@PathVariable Long id,@PathVariable String format){
        var report=service.exported(id);byte[] data;
        if(format.equals("hwpx"))data=documents.hwpx(report);else if(format.equals("pdf"))data=documents.pdf(report);else throw com.newaveflow.exception.AppException.badRequest("한글 또는 PDF 형식을 선택해주세요.");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.parseMediaType(format.equals("pdf")?"application/pdf":"application/hwp+zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename("청소년부 주간보고서 ("+report.date()+")."+format,StandardCharsets.UTF_8).build().toString()).body(data);
    }
}
