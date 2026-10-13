package com.newaveflow.controller;

import java.net.URI;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/review-config")
public class ReviewConfigController {
    private final String apiUrl;
    public ReviewConfigController(@Value("${app.review.api-url:}") String configured, Environment environment) {
        apiUrl = configured.trim().replaceAll("/+$", "");
        if (!apiUrl.isEmpty()) {
            URI uri = URI.create(apiUrl);
            boolean railway = "https".equals(uri.getScheme()) && uri.getHost() != null
                    && uri.getHost().endsWith(".up.railway.app") && uri.getPort() == -1;
            boolean local = environment.acceptsProfiles(Profiles.of("dev", "local", "test"))
                    && "http".equals(uri.getScheme()) && "localhost".equals(uri.getHost()) && uri.getPort() == 8081;
            if ((!railway && !local) || !"/api".equals(uri.getPath())
                    || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null) {
                throw new IllegalArgumentException("Invalid review API URL");
            }
        }
    }
    @GetMapping public Map<String, Object> config() {
        return Map.of("enabled", !apiUrl.isEmpty(), "apiUrl", apiUrl);
    }
}
