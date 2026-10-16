package com.newaveflow.service;

import com.newaveflow.exception.AppException;

/** Shared registration acknowledgement; it does not replace administrator approval. */
public final class RegistrationEligibility {
    public static final String REQUIRED_MESSAGE = "만 14세 이상 교사·사역 담당자만 가입할 수 있습니다. 최신 앱 또는 https://newave-flow.vercel.app/signup 에서 이용대상을 확인한 뒤 가입해 주세요.";

    private RegistrationEligibility() {}

    public static void requireConfirmed(Boolean confirmed) {
        if (!Boolean.TRUE.equals(confirmed)) throw AppException.badRequest(REQUIRED_MESSAGE);
    }
}
