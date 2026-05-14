package com.newaveflow.dto.auth;

public record FindEmailResponse(String maskedEmail) {

    public static FindEmailResponse of(String email) {
        int atIdx = email.indexOf('@');
        if (atIdx <= 1) {
            return new FindEmailResponse(email.charAt(0) + "***" + email.substring(atIdx));
        }
        int visibleLen = Math.min(3, atIdx);
        String masked = email.substring(0, visibleLen)
                + "*".repeat(atIdx - visibleLen)
                + email.substring(atIdx);
        return new FindEmailResponse(masked);
    }
}
