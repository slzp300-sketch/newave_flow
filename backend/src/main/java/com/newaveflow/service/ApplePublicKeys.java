package com.newaveflow.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.newaveflow.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.math.BigInteger;
import java.security.KeyFactory;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.time.Instant;
import java.util.*;

@Component @RequiredArgsConstructor
public class ApplePublicKeys {
    private final AppleTransport transport;
    private Map<String, RSAPublicKey> keys = Map.of();
    private Instant refreshedAt = Instant.EPOCH;
    private Instant attemptedAt = Instant.EPOCH;

    public synchronized RSAPublicKey resolve(String kid) {
        if (kid == null || !kid.matches("[A-Za-z0-9_-]{1,100}")) throw invalid();
        Instant now = Instant.now();
        if (now.isAfter(refreshedAt.plusSeconds(3600)) || !keys.containsKey(kid)) {
            // Unknown IDs must not amplify a request into unbounded calls to Apple.
            if (now.isAfter(attemptedAt.plusSeconds(60))) {
                attemptedAt = now;
                keys = parse(transport.publicKeys());
                refreshedAt = now;
            }
        }
        if (now.isAfter(refreshedAt.plusSeconds(3600)) || !keys.containsKey(kid)) throw invalid();
        return keys.get(kid);
    }

    static Map<String, RSAPublicKey> parse(JsonNode document) {
        try {
            var result = new HashMap<String, RSAPublicKey>();
            var list = document.path("keys");
            if (!list.isArray() || list.isEmpty() || list.size() > 20) throw new IllegalArgumentException();
            for (JsonNode key : list) {
                if (!"RSA".equals(key.path("kty").asText()) || !"RS256".equals(key.path("alg").asText()) || !"sig".equals(key.path("use").asText())) continue;
                String kid = key.path("kid").asText();
                if (!kid.matches("[A-Za-z0-9_-]{1,100}")) throw new IllegalArgumentException();
                var modulus = new BigInteger(1, Base64.getUrlDecoder().decode(key.path("n").asText()));
                var exponent = new BigInteger(1, Base64.getUrlDecoder().decode(key.path("e").asText()));
                if (modulus.bitLength() < 2048 || modulus.bitLength() > 8192 || exponent.signum() <= 0 || exponent.bitLength() > 32) throw new IllegalArgumentException();
                var publicKey = (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(new RSAPublicKeySpec(modulus, exponent));
                if (result.put(kid, publicKey) != null) throw new IllegalArgumentException();
            }
            if (result.isEmpty()) throw new IllegalArgumentException();
            return Map.copyOf(result);
        } catch (Exception e) { throw invalid(); }
    }
    private static AppException invalid() { return AppException.badRequest("Apple 서명을 확인하지 못했어요. 다시 시도해 주세요."); }
}
