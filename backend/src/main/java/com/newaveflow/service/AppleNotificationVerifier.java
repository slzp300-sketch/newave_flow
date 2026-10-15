package com.newaveflow.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.config.AppleProperties;
import com.newaveflow.exception.AppException;
import io.jsonwebtoken.Jwts;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.Base64;
import java.util.Set;

/** Verifies Apple JWS before exposing any event fields to the application. Never logs payloads. */
@Component @RequiredArgsConstructor
public class AppleNotificationVerifier {
    private final AppleProperties config;
    private final ApplePublicKeys keys;
    private final ObjectMapper json;
    private static final Set<String> TYPES = Set.of("consent-revoked", "account-deleted", "email-enabled", "email-disabled");

    public record Event(String id, String payloadHash, String type, String subject, long eventTime) {
        public boolean revokesAccess() { return type.equals("consent-revoked") || type.equals("account-deleted"); }
    }

    public Event verify(String token) {
        if (token == null || token.isBlank() || token.length() > 16384) throw invalid();
        String[] parts = token.split("\\.", -1);
        if (parts.length != 3 || parts[0].length() > 2048) throw invalid();
        try {
            JsonNode header = json.readTree(Base64.getUrlDecoder().decode(parts[0]));
            if (!"RS256".equals(header.path("alg").asText()) || header.has("jku") || header.has("jwk") || header.has("x5u")
                    || header.has("crit") || header.has("b64")) throw invalid();
            java.security.interfaces.RSAPublicKey key;
            try { key = keys.resolve(header.path("kid").asText()); }
            catch (Exception unavailable) {
                // A rotating/temporarily unavailable Apple key must remain retryable. No unverified data is persisted.
                throw new AppException(HttpStatus.SERVICE_UNAVAILABLE, "Apple 알림 서명을 확인할 수 없습니다. 다시 시도해 주세요.");
            }
            var claims = Jwts.parser().verifyWith(key).requireIssuer("https://appleid.apple.com")
                .requireAudience(config.getClientId()).clockSkewSeconds(60).build().parseSignedClaims(token).getPayload();
            // Apple documents no exp or maximum redelivery age. Optional exp/nbf are checked by the JWT parser.
            JsonNode payload = json.readTree(Base64.getUrlDecoder().decode(parts[1]));
            long issued = positiveSeconds(payload.path("iat"));
            long now = Instant.now().getEpochSecond();
            if (issued > now + 60 || claims.getAudience().size() != 1) throw invalid();
            String id = text(payload.path("jti"), 255);
            JsonNode event = payload.path("events");
            // Some Apple integrations encode the events object as a JSON string; the signed contents remain authoritative.
            if (event.isTextual() && event.textValue().length() <= 8192) event = json.readTree(event.textValue());
            if (!event.isObject()) throw invalid();
            String type = text(event.path("type"), 100);
            String subject = text(event.path("sub"), 255);
            long time = positiveSeconds(event.path("event_time"));
            if (time > now + 60 || time > issued + 60) throw invalid();
            // Unknown types are valid signed deliveries, but cannot mutate account state.
            return new Event(id, AppleClient.sha256(parts[1]), TYPES.contains(type) ? type : "unknown", subject, time);
        } catch (AppException e) { throw e; }
        catch (Exception malformed) { throw invalid(); }
    }
    private static long positiveSeconds(JsonNode value) {
        if (!value.isIntegralNumber() || !value.canConvertToLong() || value.longValue() <= 0) throw invalid();
        return value.longValue();
    }
    private static String text(JsonNode value, int max) {
        if (!value.isTextual() || value.textValue().isBlank() || value.textValue().length() > max
                || value.textValue().codePoints().anyMatch(Character::isISOControl)) throw invalid();
        return value.textValue();
    }
    private static AppException invalid() { return AppException.badRequest("Apple 알림을 확인할 수 없습니다."); }
}
