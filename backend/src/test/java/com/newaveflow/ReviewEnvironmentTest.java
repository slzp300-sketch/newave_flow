package com.newaveflow;

import com.newaveflow.config.ReviewEnvironmentGuard;
import com.newaveflow.security.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import static org.junit.jupiter.api.Assertions.*;

class ReviewEnvironmentTest {
    private static final String KEY = "synthetic-review-key-64-characters-long-for-boundary-test-only-12345";
    private MockEnvironment safeEnvironment() {
        var env = new MockEnvironment(); env.setActiveProfiles("review");
        env.setProperty("spring.datasource.driver-class-name", "org.h2.Driver");
        env.setProperty("spring.datasource.url", "jdbc:h2:file:./synthetic-review");
        env.setProperty("app.review.mode", "true");
        env.setProperty("jwt.issuer", "newave-flow-review");
        env.setProperty("jwt.accept-legacy-issuer", "false");
        for (String key : new String[]{"jwt.secret", "spring.datasource.password", "app.review.teacher-password", "app.review.admin-password"}) env.setProperty(key, KEY);
        return env;
    }
    @Test void reviewGuardFailsBeforeDatabaseInitializationForMixedProfilesOrMountedProductionCredentials() {
        var guard = new ReviewEnvironmentGuard();
        assertDoesNotThrow(() -> guard.postProcessEnvironment(safeEnvironment(), null));
        var mixed = safeEnvironment(); mixed.setActiveProfiles("review", "prod");
        assertThrows(IllegalStateException.class, () -> guard.postProcessEnvironment(mixed, null));
        for (String key : new String[]{"PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD", "JWT_SECRET", "KAKAO_REST_API_KEY", "KAKAO_CLIENT_SECRET", "KAKAO_ADMIN_KEY", "APPLE_PRIVATE_KEY", "APPLE_TOKEN_ENCRYPTION_KEY", "apple.private-key", "apple.token-encryption-key", "BOOTSTRAP_ADMIN_PASSWORD"}) {
            var env = safeEnvironment(); env.setProperty(key, "synthetic-not-allowed");
            assertThrows(IllegalStateException.class, () -> guard.postProcessEnvironment(env, null), key);
        }
        for (String key : new String[]{"app.seed.enabled", "kakao.enabled", "apple.enabled", "apple.notifications-enabled", "APPLE_NOTIFICATIONS_ENABLED", "spring.h2.console.enabled", "jwt.accept-legacy-issuer"}) {
            var env = safeEnvironment(); env.setProperty(key, "true");
            assertThrows(IllegalStateException.class, () -> guard.postProcessEnvironment(env, null), key);
        }
        var database = safeEnvironment(); database.setProperty("spring.datasource.url", "jdbc:postgresql://localhost/not-a-real-db");
        assertThrows(IllegalStateException.class, () -> guard.postProcessEnvironment(database, null));
        database.setProperty("spring.datasource.url", "jdbc:postgresql://synthetic-private-host/example?password=synthetic-secret");
        var error = assertThrows(IllegalStateException.class, () -> guard.postProcessEnvironment(database, null));
        assertFalse(error.getMessage().contains("synthetic-secret"));
        assertFalse(error.getMessage().contains("synthetic-private-host"));
    }
    @Test void bothAccessAndRefreshTokensRejectOtherIssuerEvenIfKeysAreAccidentallyEqual() {
        var production = new JwtTokenProvider(KEY, 3600000, 604800000, "newave-flow", true);
        var review = new JwtTokenProvider(KEY, 3600000, 604800000, "newave-flow-review", false);
        for (String purpose : new String[]{"access", "refresh"}) {
            String normal = purpose.equals("access") ? production.createAccessToken(1L, "synthetic@example.invalid", "ADMIN") : production.createRefreshToken(1L, "synthetic@example.invalid", "ADMIN");
            String isolated = purpose.equals("access") ? review.createAccessToken(1L, "play.admin@review.newaveflow.invalid", "ADMIN") : review.createRefreshToken(1L, "play.admin@review.newaveflow.invalid", "ADMIN");
            assertThrows(io.jsonwebtoken.JwtException.class, () -> production.requireToken(isolated, purpose));
            assertThrows(io.jsonwebtoken.JwtException.class, () -> review.requireToken(normal, purpose));
            assertDoesNotThrow(() -> production.requireToken(normal, purpose));
            assertDoesNotThrow(() -> review.requireToken(isolated, purpose));
        }
    }
    @Test void productionLegacyTokensRemainUsableButReviewRejectsTokensWithoutIssuer() {
        var key = io.jsonwebtoken.security.Keys.hmacShaKeyFor(KEY.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        String legacy = io.jsonwebtoken.Jwts.builder().subject("1").claim("purpose", "access")
                .expiration(new java.util.Date(System.currentTimeMillis() + 60000)).signWith(key).compact();
        assertDoesNotThrow(() -> new JwtTokenProvider(KEY, 1, 1, "newave-flow", true).requireToken(legacy, "access"));
        assertThrows(io.jsonwebtoken.JwtException.class, () -> new JwtTokenProvider(KEY, 1, 1, "newave-flow-review", false).requireToken(legacy, "access"));
    }
}
