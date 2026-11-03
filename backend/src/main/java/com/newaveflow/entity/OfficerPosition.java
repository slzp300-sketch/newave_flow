package com.newaveflow.entity;

/** Church offices are assigned separately from editable profile titles and account roles. */
public enum OfficerPosition {
    PASTOR("목사", "목사", null), DIRECTOR("부장", "부장", null),
    DEPUTY_MALE("부감(남)", "부감", null), DEPUTY_FEMALE("부감(여)", "부감", null),
    GENERAL("총무", "운영 임원", null), VICE_GENERAL("부총무", "운영 임원", null),
    TREASURER("회계", "운영 임원", null), SECRETARY("서기", "운영 임원", null),
    INTERCESSION("중보기도팀장", "팀장", null), PRAISE("찬양팀장", "팀장", null),
    WORSHIP("예배운영팀장", "팀장", null), NEW_FAMILY("새가족팀장", "팀장", null),
    GRADE_M1("중1 학년부장", "학년부장", "중1"), GRADE_M2("중2 학년부장", "학년부장", "중2"),
    GRADE_M3("중3 학년부장", "학년부장", "중3"), GRADE_H1("고1 학년부장", "학년부장", "고1"),
    GRADE_H2("고2 학년부장", "학년부장", "고2"), GRADE_H3("고3 학년부장", "학년부장", "고3");
    public final String label, group, grade;
    OfficerPosition(String label, String group, String grade) { this.label=label; this.group=group; this.grade=grade; }
}
