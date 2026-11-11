package com.newaveflow.config;

import java.util.Arrays;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;

/** Runs after config loading, before any DataSource or schema initialization. */
public class ReviewEnvironmentGuard implements EnvironmentPostProcessor, Ordered {
    @Override public int getOrder() { return Ordered.LOWEST_PRECEDENCE; }
    @Override public void postProcessEnvironment(ConfigurableEnvironment env, SpringApplication app) {
        if (!Arrays.asList(env.getActiveProfiles()).contains("review")) return;
        if (env.getActiveProfiles().length != 1) fail("review must be the only active profile");
        if (!env.getProperty("spring.datasource.driver-class-name", "").equals("org.h2.Driver")
                || !env.getProperty("spring.datasource.url", "").startsWith("jdbc:h2:file:")) {
            fail("review requires its own file-based H2 database (driver configured: "
                    + env.containsProperty("spring.datasource.driver-class-name") + ", file URL configured: "
                    + env.getProperty("spring.datasource.url", "").startsWith("jdbc:h2:file:")
                    + ", database kind: " + databaseKind(env.getProperty("spring.datasource.url", "")) + ")");
        }
        for (String key : new String[]{"PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD", "JWT_SECRET",
                "KAKAO_REST_API_KEY", "KAKAO_CLIENT_SECRET", "KAKAO_ADMIN_KEY", "APPLE_PRIVATE_KEY", "APPLE_TOKEN_ENCRYPTION_KEY",
                "PUSH_APNS_PRIVATE_KEY", "PUSH_FCM_PRIVATE_KEY", "BOOTSTRAP_ADMIN_PASSWORD"}) {
            if (!env.getProperty(key, "").isBlank()) fail("production credentials must not be mounted in review");
        }
        if (env.getProperty("app.seed.enabled", Boolean.class, false)
                || env.getProperty("kakao.enabled", Boolean.class, false)
                || env.getProperty("apple.enabled", Boolean.class, false)
                || env.getProperty("apple.notifications-enabled", Boolean.class, false)
                || env.getProperty("APPLE_NOTIFICATIONS_ENABLED", Boolean.class, false)
                || env.getProperty("PUSH_ENABLED", Boolean.class, false)
                || !env.getProperty("apple.private-key", "").isBlank()
                || !env.getProperty("apple.token-encryption-key", "").isBlank()
                || env.getProperty("spring.h2.console.enabled", Boolean.class, false)
                || !env.getProperty("app.review.mode", Boolean.class, false)
                || !"newave-flow-review".equals(env.getProperty("jwt.issuer"))
                || env.getProperty("jwt.accept-legacy-issuer", Boolean.class, true)) {
            fail("unsafe review configuration");
        }
        for (String key : new String[]{"jwt.secret", "spring.datasource.password", "app.review.teacher-password", "app.review.admin-password"}) {
            if (env.getProperty(key, "").length() < 24) fail("review secrets must contain at least 24 characters");
        }
    }
    private static void fail(String reason) { throw new IllegalStateException(reason); }
    private static String databaseKind(String url) {
        if (url.isBlank()) return "unset";
        if (url.startsWith("jdbc:h2:file:")) return "H2 file";
        if (url.startsWith("jdbc:h2:mem:")) return "H2 memory";
        if (url.startsWith("jdbc:postgresql:")) return "PostgreSQL";
        return "other";
    }
}
