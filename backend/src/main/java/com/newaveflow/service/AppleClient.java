package com.newaveflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.config.AppleProperties;
import com.newaveflow.exception.AppException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

@Component @RequiredArgsConstructor
public class AppleClient {
    private final AppleProperties config;
    private final AppleTransport transport;
    private final ApplePublicKeys publicKeys;
    private final ObjectMapper json;
    private static final String ISSUER = "https://appleid.apple.com";

    public record Credential(String subject, String refreshToken) {}

    public String verifiedSubject(String identityToken, String nonceHash) { return verify(identityToken, nonceHash).getSubject(); }

    public Credential identify(String identityToken, String authorizationCode, String nonceHash) {
        try {
            Claims nativeClaims = verify(identityToken, nonceHash);
            var response = transport.exchange(authorizationCode, clientSecret());
            Claims exchangedClaims = verify(response.path("id_token").asText(), nonceHash);
            if (!nativeClaims.getSubject().equals(exchangedClaims.getSubject())) throw new IllegalArgumentException();
            String refresh = response.path("refresh_token").asText();
            if (refresh.isBlank() || refresh.length() > 16384) throw new IllegalArgumentException();
            return new Credential(nativeClaims.getSubject(), refresh);
        } catch (Exception e) { throw invalid(); }
    }

    public void revoke(String refreshToken) { transport.revoke(refreshToken, clientSecret()); }

    Claims verify(String token, String nonceHash) {
        try {
            if (token == null || token.length() > 16384) throw new IllegalArgumentException();
            String[] parts = token.split("\\.", -1);
            if (parts.length != 3 || parts[0].length() > 2048) throw new IllegalArgumentException();
            var header = json.readTree(Base64.getUrlDecoder().decode(parts[0]));
            if (!"RS256".equals(header.path("alg").asText()) || header.has("jku") || header.has("jwk") || header.has("x5u")) throw new IllegalArgumentException();
            var signed = Jwts.parser().verifyWith(publicKeys.resolve(header.path("kid").asText()))
                .requireIssuer(ISSUER).requireAudience(config.getClientId()).build().parseSignedClaims(token);
            Claims claims = signed.getPayload();
            Instant now = Instant.now();
            String subject = claims.getSubject();
            String nonce = claims.get("nonce", String.class);
            if (subject == null || subject.isBlank() || subject.length() > 255 || claims.getExpiration() == null || claims.getIssuedAt() == null
                || claims.getIssuedAt().toInstant().isAfter(now.plusSeconds(30)) || claims.getIssuedAt().toInstant().isBefore(now.minusSeconds(600))
                || nonce == null || !nonce.matches("[A-Za-z0-9_-]{43}") || !constantEquals(sha256(nonce), nonceHash)) throw new IllegalArgumentException();
            return claims;
        } catch (Exception e) { throw invalid(); }
    }

    String clientSecret() {
        Instant now = Instant.now();
        return Jwts.builder().header().keyId(config.getKeyId()).and().issuer(config.getTeamId()).subject(config.getClientId())
            .audience().add(ISSUER).and().issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(300)))
            .signWith(config.signingKey(), Jwts.SIG.ES256).compact();
    }
    static String sha256(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
    static boolean constantEquals(String a, String b) {
        return a != null && b != null && MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
    private static AppException invalid() { return AppException.badRequest("Apple 인증을 확인하지 못했어요. Apple 로그인을 다시 시작해 주세요."); }
}
