package com.newaveflow.service;

import com.newaveflow.entity.*;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.*;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.*;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class CommunitySafetyService {
    public static final String POLICY_VERSION = "2026-10-14-v1";
    private final CommunityAgreementRepository agreements;
    private final ContentReportRepository reports;
    private final UserRepository users;
    private final MeetingMinuteRepository minutes;
    private final DailyReportRepository dailyReports;
    private final ClassAccessService access;

    public record PolicySection(String title, String text) {}
    public record Policy(String version, String title, List<PolicySection> sections) {}
    public Policy policy() {
        return new Policy(POLICY_VERSION, "뉴웨이브 플로우 이용수칙", List.of(
            new PolicySection("사역을 위한 기록", "승인된 교사와 사역 담당자가 자신의 권한 안에서 출석·보고·회의·사진을 기록합니다. 계정을 다른 사람과 공유하거나 자료를 외부에 무단으로 전달하지 않습니다."),
            new PolicySection("서로를 존중하는 내용", "괴롭힘·위협·혐오·차별·사칭·성적이거나 폭력적인 내용, 불법 행위와 아동 착취를 조장하는 내용은 게시할 수 없습니다. 허위 정보와 반복적인 광고도 금지합니다."),
            new PolicySection("개인정보와 사진 보호", "학생과 교사의 개인정보·건강·신앙 관련 내용은 업무에 꼭 필요한 범위로 기록합니다. 동의나 적절한 권한 없이 다른 사람의 사진·연락처·민감한 정보를 올리거나 유출하지 않습니다."),
            new PolicySection("문제 발견 시 신고", "전체 메뉴의 ‘콘텐츠·사용자 신고’ 또는 회의록·교사 정보의 신고 버튼으로 문제를 알릴 수 있습니다. 신고는 신고자와 담당 관리자만 확인합니다. 긴급한 위험은 담당 사역자에게도 즉시 알려주세요."),
            new PolicySection("관리자의 검토와 조치", "관리자는 신고를 검토하고 필요에 따라 콘텐츠를 비공개로 바꾸거나 수정하고 계정 이용을 제한할 수 있습니다. 처리 결과는 내 신고 내역에서 확인할 수 있으며, 이의가 있으면 앱의 지원 문의로 연락해주세요."),
            new PolicySection("동의 기록", "콘텐츠를 작성하기 전에 이 이용수칙에 동의해야 합니다. 동의한 버전과 실제 동의 시각을 계정에 기록합니다. 개인정보 관련 별도 안내와 동의를 이 확인으로 대신하지 않습니다.")
        ));
    }

    public record AgreementView(String version, boolean accepted, LocalDateTime acceptedAt) {}
    public AgreementView agreement(Long userId) {
        return agreements.findById(userId).map(a -> new AgreementView(POLICY_VERSION,
            POLICY_VERSION.equals(a.getPolicyVersion()), a.getAcceptedAt()))
            .orElse(new AgreementView(POLICY_VERSION, false, null));
    }
    @Transactional public AgreementView accept(Long userId, String version, boolean accepted) {
        if (!accepted || !POLICY_VERSION.equals(version)) throw AppException.badRequest("현재 이용수칙을 확인하고 동의해주세요.");
        users.lockById(userId).orElseThrow(() -> AppException.unauthorized("로그인이 필요합니다."));
        CommunityAgreement existing = agreements.findById(userId).orElse(null);
        if (existing == null) agreements.save(new CommunityAgreement(userId, version));
        else if (!version.equals(existing.getPolicyVersion())) existing.accept(version);
        return agreement(userId);
    }
    public void requireAgreement(Long userId) {
        if (!agreement(userId).accepted()) throw new AppException(HttpStatus.PRECONDITION_REQUIRED,
            "콘텐츠 작성 전에 이용수칙에 동의해주세요. 앱에 이용수칙 메뉴가 없으면 웹(newave-flow.vercel.app)에 같은 계정으로 로그인한 뒤 전체 메뉴에서 확인할 수 있습니다.");
    }
    public static boolean isModerator(User user) {
        return user != null && user.isActive() && user.getRole() != User.Role.TEACHER;
    }
    public record ReportRequest(
        @NotNull ContentReport.TargetType targetType, ContentReport.ContentType contentType,
        @Positive Long targetId, @Size(max = 200) String subject,
        @NotNull ContentReport.Reason reason,
        @NotBlank(message = "신고 내용을 입력해주세요.") @Size(max = 2000) String details,
        @NotBlank @Pattern(regexp = "[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}") String requestId) {}
    public record ResolveRequest(@NotNull ContentReport.Status status, @NotNull ContentReport.Action action,
        @NotBlank(message = "검토 결과와 조치 내용을 입력해주세요.") @Size(max = 2000) String note,
        @NotNull @PositiveOrZero Long expectedRevision) {}
    public record ReportView(Long id, long revision, ContentReport.TargetType targetType,
        ContentReport.ContentType contentType, Long targetId, String subject, ContentReport.Reason reason,
        String details, ContentReport.Status status, ContentReport.Action action, String resolutionNote,
        String reporterName, LocalDateTime createdAt, LocalDateTime updatedAt, LocalDateTime resolvedAt) {}
    private ReportView view(ContentReport r) {
        String reporter = users.findById(r.getReporterId()).map(User::getName).orElse("삭제된 계정");
        return new ReportView(r.getId(), r.getRevision(), r.getTargetType(), r.getContentType(), r.getTargetId(),
            r.getSubject(), r.getReason(), r.getDetails(), r.getStatus(), r.getAction(), r.getResolutionNote(),
            reporter, r.getCreatedAt(), r.getUpdatedAt(), r.getResolvedAt());
    }
    public List<Map<String, Object>> reportableUsers() {
        return users.findByIsActiveTrue().stream().map(u -> Map.<String, Object>of("id", u.getId(), "name", u.getName())).toList();
    }
    @Transactional public ReportView create(User actor, ReportRequest request) {
        users.lockById(actor.getId()).orElseThrow(() -> AppException.unauthorized("로그인이 필요합니다."));
        ContentReport duplicate = reports.findByReporterIdAndRequestId(actor.getId(), request.requestId()).orElse(null);
        if (duplicate != null) {
            if (duplicate.getTargetType() != request.targetType() || duplicate.getContentType() != request.contentType()
                || !Objects.equals(duplicate.getTargetId(), request.targetId()) || duplicate.getReason() != request.reason()
                || (request.contentType() == ContentReport.ContentType.OTHER && !Objects.equals(duplicate.getSubject(), request.subject() == null ? null : request.subject().trim()))
                || !duplicate.getDetails().equals(request.details().trim())) throw AppException.conflict("신고 요청 번호가 다른 내용에 사용되었습니다.");
            return view(duplicate);
        }
        if (reports.countByReporterIdAndCreatedAtAfter(actor.getId(), LocalDateTime.now().minusDays(1)) >= 10)
            throw AppException.badRequest("하루에 신고를 10건까지 접수할 수 있습니다. 긴급한 문제는 담당 사역자에게 문의해주세요.");
        String subject;
        if (request.targetType() == ContentReport.TargetType.USER) {
            if (request.contentType() != null || request.targetId() == null) throw AppException.badRequest("신고할 사용자를 선택해주세요.");
            User target = users.findById(request.targetId()).filter(User::isActive).orElseThrow(() -> AppException.notFound("사용자를 찾을 수 없습니다."));
            subject = target.getName();
        } else {
            if (request.contentType() == null) throw AppException.badRequest("신고할 콘텐츠를 선택해주세요.");
            subject = switch (request.contentType()) {
                case MEETING_MINUTE -> {
                    if (request.targetId() == null) throw AppException.badRequest("회의록을 선택해주세요.");
                    var minute = minutes.findById(request.targetId()).orElseThrow(() -> AppException.notFound("회의록을 찾을 수 없습니다."));
                    if (!minute.isActive() && !isModerator(actor)) throw AppException.notFound("회의록을 찾을 수 없습니다.");
                    yield minute.getTitle();
                }
                case DAILY_REPORT -> {
                    if (request.targetId() == null) throw AppException.badRequest("보고서를 선택해주세요.");
                    var report = dailyReports.findById(request.targetId()).orElseThrow(() -> AppException.notFound("보고서를 찾을 수 없습니다."));
                    access.requireClass(actor, report.getClassGroup().getId());
                    yield report.getReportDate() + " " + report.getClassGroup().getName() + " 출결보고";
                }
                case OTHER -> {
                    if (request.targetId() != null || request.subject() == null || request.subject().isBlank())
                        throw AppException.badRequest("문제가 있는 화면이나 콘텐츠를 적어주세요.");
                    yield request.subject().trim();
                }
            };
        }
        return view(reports.saveAndFlush(ContentReport.builder().reporterId(actor.getId()).requestId(request.requestId())
            .targetType(request.targetType()).contentType(request.contentType()).targetId(request.targetId())
            .subject(subject).reason(request.reason()).details(request.details().trim()).build()));
    }
    public Page<ReportView> list(User actor, boolean management, ContentReport.Status status, int page) {
        if (page < 0 || page > 10000) throw AppException.badRequest("페이지 번호가 올바르지 않습니다.");
        Pageable pageable = PageRequest.of(page, 20, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        if (!management) return reports.findByReporterId(actor.getId(), pageable).map(this::view);
        if (!isModerator(actor)) throw AppException.forbidden("관리자만 신고를 검토할 수 있습니다.");
        return (status == null ? reports.findAll(pageable) : reports.findByStatus(status, pageable)).map(this::view);
    }
    @Transactional public ReportView resolve(User actor, Long id, ResolveRequest request) {
        if (!isModerator(actor)) throw AppException.forbidden("관리자만 신고를 처리할 수 있습니다.");
        var report = reports.lockById(id).orElseThrow(() -> AppException.notFound("신고를 찾을 수 없습니다."));
        if (report.getRevision() != request.expectedRevision()) throw AppException.conflict("다른 관리자가 처리 내용을 변경했습니다. 새로고침 후 다시 확인해주세요.");
        if (report.getResolvedAt() != null) throw AppException.conflict("이미 처리가 끝난 신고입니다.");
        if (request.status() == ContentReport.Status.OPEN ||
            (request.status() != ContentReport.Status.RESOLVED && request.action() != ContentReport.Action.NONE) ||
            (request.status() == ContentReport.Status.RESOLVED && request.action() == ContentReport.Action.NONE))
            throw AppException.badRequest("검토 상태와 조치를 확인해주세요.");
        if (request.action() == ContentReport.Action.HIDE_MINUTE) {
            if (report.getTargetType() != ContentReport.TargetType.CONTENT || report.getContentType() != ContentReport.ContentType.MEETING_MINUTE)
                throw AppException.badRequest("회의록 신고에서만 비공개 처리할 수 있습니다.");
            minutes.findById(report.getTargetId()).orElseThrow(() -> AppException.notFound("회의록을 찾을 수 없습니다.")).setActive(false);
        } else if (request.action() == ContentReport.Action.SUSPEND_USER) {
            if (report.getTargetType() != ContentReport.TargetType.USER || report.getTargetId() == null)
                throw AppException.badRequest("사용자 신고에서만 이용을 제한할 수 있습니다.");
            User target = users.lockById(report.getTargetId()).orElseThrow(() -> AppException.notFound("사용자를 찾을 수 없습니다."));
            if (target.getId().equals(actor.getId()) ||
                ((target.getRole() == User.Role.ADMIN || target.getRole() == User.Role.PASTOR) && actor.getRole() != User.Role.ADMIN))
                throw AppException.forbidden("본인 계정은 제한할 수 없으며 관리자·목사 계정 제한은 최종 관리자만 가능합니다.");
            target.suspend();
        }
        report.resolve(request.status(), request.action(), request.note().trim(), actor.getId());
        reports.flush();
        return view(report);
    }
}
