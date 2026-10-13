package com.newaveflow.config;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import java.net.URI;

@Component
@ConfigurationProperties(prefix = "kakao")
@Getter @Setter
public class KakaoProperties {
    private boolean enabled;
    private String clientId = "";
    private String clientSecret = "";
    private String adminKey = "";
    private String appId = "";
    private String redirectUri = "https://newaveflow-production.up.railway.app/api/auth/kakao/callback";
    private String webReturnUri = "https://newave-flow.vercel.app/auth/kakao/callback";

    @PostConstruct void validate() {
        if (!enabled) return;
        if (clientId.isBlank() || clientSecret.isBlank() || adminKey.isBlank() || !appId.matches("[0-9]+")) throw new IllegalStateException("Kakao credentials and webhook app ID are required when enabled.");
        validateUri(redirectUri); validateUri(webReturnUri);
    }
    private void validateUri(String value) {
        URI uri = URI.create(value);
        boolean local = "http".equals(uri.getScheme()) && ("localhost".equals(uri.getHost()) || "127.0.0.1".equals(uri.getHost()));
        if ((!"https".equals(uri.getScheme()) && !local) || uri.getHost() == null || uri.getUserInfo() != null || uri.getFragment() != null || uri.getQuery() != null) {
            throw new IllegalStateException("Kakao callback URLs must use HTTPS (localhost HTTP is allowed).");
        }
    }
}
