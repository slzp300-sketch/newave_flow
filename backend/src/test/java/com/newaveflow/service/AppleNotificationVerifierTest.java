package com.newaveflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.config.AppleProperties;
import com.newaveflow.exception.AppException;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.*;
import java.security.*;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AppleNotificationVerifierTest {
    static KeyPair rsa;
    static final String CLIENT = "app.synthetic.notification";
    final ObjectMapper json = new ObjectMapper();
    AppleNotificationVerifier verifier;
    ApplePublicKeys keys;
    @BeforeAll static void key() throws Exception { var g = KeyPairGenerator.getInstance("RSA"); g.initialize(2048); rsa = g.generateKeyPair(); }
    @BeforeEach void setup() {
        var config = new AppleProperties(); config.setClientId(CLIENT);
        keys = mock(ApplePublicKeys.class); when(keys.resolve("synthetic")).thenReturn((RSAPublicKey) rsa.getPublic());
        verifier = new AppleNotificationVerifier(config, keys, json);
    }
    Map<String,Object> claims() {
        long now = Instant.now().getEpochSecond();
        var c = new HashMap<String,Object>(); c.put("iss", "https://appleid.apple.com"); c.put("aud", CLIENT); c.put("iat", now); c.put("jti", "synthetic-event");
        c.put("events", Map.of("type", "consent-revoked", "sub", "synthetic-subject", "event_time", now - 1)); return c;
    }
    String token(Map<String,Object> claims) { return Jwts.builder().header().keyId("synthetic").and().claims(claims).signWith(rsa.getPrivate(), Jwts.SIG.RS256).compact(); }
    @Test void officialNotificationNeedsNoExpirationAndUsesEpochSeconds() throws Exception {
        var c = claims(); var result = verifier.verify(token(c));
        assertEquals("consent-revoked", result.type()); assertEquals("synthetic-subject", result.subject());
        assertEquals(64, result.payloadHash().length()); assertTrue(result.revokesAccess());
        c.put("events", json.writeValueAsString(c.get("events"))); assertTrue(verifier.verify(token(c)).revokesAccess());
    }
    @Test void delayedAuthenticNotificationsAreAcceptedWithoutInventingARetryDeadline() {
        var c = claims(); long old = Instant.now().minusSeconds(45L*86400).getEpochSecond(); c.put("iat", old);
        c.put("events", Map.of("type", "account-deleted", "sub", "synthetic-subject", "event_time", old));
        assertEquals(old, verifier.verify(token(c)).eventTime());
    }
    @Test void rejectsWrongIssuerAudienceFutureTimeMillisecondsMissingIdAndMalformedEvents() {
        for (var bad : List.of(Map.of("iss", "https://attacker.invalid"), Map.of("aud", "other.app"),
                Map.of("aud", List.of(CLIENT,"other.app")), Map.of("iat", Instant.now().getEpochSecond()+120),
                Map.of("jti", ""), Map.of("events", "not-json"))) {
            var c = claims(); c.putAll(bad); assertThrows(AppException.class, () -> verifier.verify(token(c)));
        }
        for (Object time : List.of(System.currentTimeMillis(), Instant.now().getEpochSecond()+120, "123", -1, 1.5)) {
            var c = claims(); c.put("events", Map.of("type", "consent-revoked", "sub", "synthetic-subject", "event_time", time));
            assertThrows(AppException.class, () -> verifier.verify(token(c)));
        }
        var c = claims(); c.remove("iat"); String missingIat = token(c); assertThrows(AppException.class, () -> verifier.verify(missingIat));
        c = claims(); c.remove("jti"); String missing = token(c); assertThrows(AppException.class, () -> verifier.verify(missing));
    }
    @Test void rejectsForgedSignatureAlgorithmConfusionAndEmbeddedKeys() throws Exception {
        var other = KeyPairGenerator.getInstance("RSA"); other.initialize(2048);
        String forged = Jwts.builder().header().keyId("synthetic").and().claims(claims()).signWith(other.generateKeyPair().getPrivate(), Jwts.SIG.RS256).compact();
        assertThrows(AppException.class, () -> verifier.verify(forged));
        String embedded = Jwts.builder().header().keyId("synthetic").add("jku", "https://attacker.invalid").and().claims(claims()).signWith(rsa.getPrivate(), Jwts.SIG.RS256).compact();
        assertThrows(AppException.class, () -> verifier.verify(embedded));
        String none = Base64.getUrlEncoder().withoutPadding().encodeToString("{\"alg\":\"none\"}".getBytes())+".e30.";
        assertThrows(AppException.class, () -> verifier.verify(none));
        assertThrows(AppException.class, () -> verifier.verify("x".repeat(16385)));
    }
    @Test void expiredOptionalClaimIsRejectedAndUnavailableKeyRemainsRetryable() {
        var c = claims(); c.put("exp", Instant.now().getEpochSecond()-120); assertThrows(AppException.class, () -> verifier.verify(token(c)));
        when(keys.resolve(anyString())).thenThrow(AppException.badRequest("synthetic network unavailable"));
        var failure = assertThrows(AppException.class, () -> verifier.verify(token(claims())));
        assertEquals(503, failure.getStatus().value()); assertFalse(failure.getMessage().contains("synthetic network"));
    }
    @Test void emailAndUnknownEventsCannotReenableOrDeleteAnAccount() {
        for (String type : List.of("email-enabled", "email-disabled", "future-type")) {
            var c = claims(); c.put("events", Map.of("type",type,"sub","synthetic-subject","event_time",Instant.now().getEpochSecond()));
            assertFalse(verifier.verify(token(c)).revokesAccess());
        }
    }
}
