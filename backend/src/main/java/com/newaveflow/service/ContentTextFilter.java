package com.newaveflow.service;

import com.newaveflow.exception.AppException;
import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/** Local, conservative pre-publication checks. No source text is logged or sent elsewhere. */
public final class ContentTextFilter {
    private ContentTextFilter() {}
    private static final Pattern SEPARATORS = Pattern.compile("[\\p{Z}\\p{P}\\p{S}\\p{C}]+");
    private static final Pattern CLEAR_HARM = Pattern.compile(
        "(?:죽여버리겠다|죽여버릴거야|죽여버린다|너를죽이겠다|너죽여버|다죽여버리|" +
        "아동음란물(?:판매|구매|공유)|아동성착취물(?:판매|구매|공유)|몰카(?:판매|유포)|" +
        "강간해버리|씨발놈|씨발년|개새끼|병신새끼|fuckyou|kill(?:you|yourfamily))");
    public static void check(String... fields) {
        for (String value : fields) {
            if (value == null || value.isBlank()) continue;
            if (value.length() > 100_000) throw AppException.badRequest("입력 내용이 너무 깁니다.");
            String normalized = SEPARATORS.matcher(Normalizer.normalize(value, Normalizer.Form.NFKC)
                .toLowerCase(Locale.ROOT)).replaceAll("");
            if (CLEAR_HARM.matcher(normalized).find())
                throw AppException.badRequest("공유 내용에 위협·모욕 또는 성적 착취를 조장하는 표현이 포함되어 저장할 수 없습니다. 피해 신고나 검토 요청은 콘텐츠·사용자 신고 메뉴를 이용해주세요.");
        }
    }
}
