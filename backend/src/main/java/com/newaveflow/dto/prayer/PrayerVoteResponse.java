package com.newaveflow.dto.prayer;

import com.newaveflow.entity.PrayerVote;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class PrayerVoteResponse {
    private Long id;
    private Long teacherId;
    private String teacherName;
    private String teacherGrade;
    private LocalDate weekStart;
    private String status;
    private String reason;
    private boolean scriptureCopySubmitted;
    private LocalDateTime scriptureCopySubmittedAt;

    public PrayerVoteResponse(PrayerVote vote) {
        this(vote, null);
    }

    public PrayerVoteResponse(PrayerVote vote, String explicitClassName) {
        this.id = vote.getId();
        if (vote.getTeacher() != null) {
            this.teacherId = vote.getTeacher().getId();
            this.teacherName = vote.getTeacher().getName();
            String grade = vote.getTeacher().getGrade();
            
            if (explicitClassName != null && !explicitClassName.isBlank()) {
                grade = extractGrade(explicitClassName);
            } else if (grade != null && !grade.isBlank() && !grade.equals("미분류")) {
                grade = extractGrade(grade);
            } else {
                grade = "미분류";
            }
            
            this.teacherGrade = grade;
        }
        this.weekStart = vote.getWeekStart();
        this.status = vote.getStatus().name();
        this.reason = vote.getReason();
        this.scriptureCopySubmitted = vote.isScriptureCopySubmitted();
        this.scriptureCopySubmittedAt = vote.getScriptureCopySubmittedAt();
    }

    private String extractGrade(String className) {
        if (className == null || className.isBlank()) return "미분류";
        
        String clean = className.replaceAll("\\s+", "");
        
        // 1. "유치"로 시작하면 "유치" 반환
        if (clean.startsWith("유치")) return "유치";
        
        // 2. "초/중/고" + "숫자" 조합 추출 (예: "중3-5반" -> "중3")
        java.util.regex.Pattern p = java.util.regex.Pattern.compile("([초중고])([1-6])");
        java.util.regex.Matcher m = p.matcher(clean);
        if (m.find()) {
            return m.group(1) + m.group(2);
        }
        
        // 3. "학년" 키워드 앞의 숫자 추출 (예: "6학년 2반" -> "초6" - 초등부 가정)
        if (clean.contains("학년")) {
            java.util.regex.Pattern p2 = java.util.regex.Pattern.compile("([1-6])학년");
            java.util.regex.Matcher m2 = p2.matcher(clean);
            if (m2.find()) {
                return "초" + m2.group(1); // 학년만 있으면 보통 초등부
            }
        }

        return "미분류";
    }
}
