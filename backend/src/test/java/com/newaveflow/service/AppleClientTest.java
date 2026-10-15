package com.newaveflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.config.AppleProperties;
import com.newaveflow.exception.AppException;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.*;
import java.math.BigInteger;
import java.security.*;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AppleClientTest {
    static KeyPair rsa, ec;
    static final String NONCE = "n".repeat(43);
    final ObjectMapper json = new ObjectMapper();
    AppleProperties config;
    AppleTransport transport;
    ApplePublicKeys keys;
    AppleClient client;

    @BeforeAll static void generateKeys() throws Exception {
        var rsaGenerator = KeyPairGenerator.getInstance("RSA"); rsaGenerator.initialize(2048); rsa = rsaGenerator.generateKeyPair();
        var ecGenerator = KeyPairGenerator.getInstance("EC"); ecGenerator.initialize(new ECGenParameterSpec("secp256r1")); ec = ecGenerator.generateKeyPair();
    }
    @BeforeEach void setup() {
        config = configured(); transport = mock(AppleTransport.class); keys = mock(ApplePublicKeys.class);
        when(keys.resolve("synthetic-kid")).thenReturn((RSAPublicKey) rsa.getPublic());
        client = new AppleClient(config, transport, keys, json);
    }
    AppleProperties configured() {
        var result = new AppleProperties(); result.setEnabled(true); result.setClientId("app.example.synthetic"); result.setTeamId("SYNTHETIC1"); result.setKeyId("SYNTHETIC2");
        result.setPrivateKey(Base64.getEncoder().encodeToString(ec.getPrivate().getEncoded()));
        byte[] encryption = new byte[32]; new SecureRandom().nextBytes(encryption);
        result.setTokenEncryptionKey(Base64.getEncoder().encodeToString(encryption)); return result;
    }
    String token(String subject, String nonce, String audience, Instant issued, Instant expires, PrivateKey key) {
        return Jwts.builder().header().keyId("synthetic-kid").and().issuer("https://appleid.apple.com").subject(subject)
            .audience().add(audience).and().issuedAt(Date.from(issued)).expiration(Date.from(expires)).claim("nonce", nonce)
            .signWith(key, Jwts.SIG.RS256).compact();
    }
    String valid(String subject) { return token(subject, NONCE, config.getClientId(), Instant.now(), Instant.now().plusSeconds(300), rsa.getPrivate()); }
    @Test void verifiesNativeAndExchangedTokensAndGeneratesShortLivedClientSecret() {
        when(transport.exchange(eq("synthetic-code"), anyString())).thenReturn(json.createObjectNode().put("id_token", valid("subject1")).put("refresh_token", "synthetic-refresh"));
        var identity = client.identify(valid("subject1"), "synthetic-code", AppleClient.sha256(NONCE));
        assertEquals("subject1", identity.subject()); assertEquals("synthetic-refresh", identity.refreshToken());
        var secret = Jwts.parser().verifyWith((java.security.interfaces.ECPublicKey) ec.getPublic()).build().parseSignedClaims(client.clientSecret());
        assertEquals("ES256", secret.getHeader().getAlgorithm()); assertEquals(config.getKeyId(), secret.getHeader().getKeyId());
        assertEquals(config.getTeamId(), secret.getPayload().getIssuer()); assertEquals(config.getClientId(), secret.getPayload().getSubject());
        assertEquals(Set.of("https://appleid.apple.com"), secret.getPayload().getAudience());
        assertEquals(300000, secret.getPayload().getExpiration().getTime() - secret.getPayload().getIssuedAt().getTime());
    }
    @Test void rejectsWrongNonceAudienceExpiryFutureIssueAndForgedSignatureBeforeExchangingCode() throws Exception {
        var attacker = KeyPairGenerator.getInstance("RSA"); attacker.initialize(2048);
        Instant now = Instant.now();
        for (String forged : List.of(
            token("subject1", "x".repeat(43), config.getClientId(), now, now.plusSeconds(300), rsa.getPrivate()),
            token("subject1", NONCE, "different.app", now, now.plusSeconds(300), rsa.getPrivate()),
            token("subject1", NONCE, config.getClientId(), now.minusSeconds(60), now.minusSeconds(1), rsa.getPrivate()),
            token("subject1", NONCE, config.getClientId(), now.plusSeconds(120), now.plusSeconds(300), rsa.getPrivate()),
            token("subject1", NONCE, config.getClientId(), now.minusSeconds(700), now.plusSeconds(300), rsa.getPrivate()),
            token("subject1", NONCE, config.getClientId(), now, now.plusSeconds(300), attacker.generateKeyPair().getPrivate()))) {
            assertThrows(AppException.class, () -> client.identify(forged, "unused-code", AppleClient.sha256(NONCE)));
        }
        verifyNoInteractions(transport);
    }
    @Test void rejectsAlgorithmConfusionMissingClaimsAndIncorrectIssuer() {
        var validHeader = Base64.getUrlEncoder().withoutPadding().encodeToString("{\"alg\":\"none\",\"kid\":\"synthetic-kid\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        assertThrows(AppException.class, () -> client.verify(validHeader + ".e30.", AppleClient.sha256(NONCE)));
        String missing = Jwts.builder().header().keyId("synthetic-kid").and().issuer("https://appleid.apple.com").subject("subject1")
            .audience().add(config.getClientId()).and().claim("nonce", NONCE).signWith(rsa.getPrivate(), Jwts.SIG.RS256).compact();
        assertThrows(AppException.class, () -> client.verify(missing, AppleClient.sha256(NONCE)));
        String issuer = Jwts.builder().header().keyId("synthetic-kid").and().issuer("https://attacker.invalid").subject("subject1")
            .audience().add(config.getClientId()).and().issuedAt(new Date()).expiration(Date.from(Instant.now().plusSeconds(300)))
            .claim("nonce", NONCE).signWith(rsa.getPrivate(), Jwts.SIG.RS256).compact();
        assertThrows(AppException.class, () -> client.verify(issuer, AppleClient.sha256(NONCE)));
    }
    @Test void exchangedCodeMustIdentifyTheSameSubjectAndRetainARevocableToken() {
        when(transport.exchange(anyString(), anyString())).thenReturn(json.createObjectNode().put("id_token", valid("other-subject")).put("refresh_token", "synthetic-refresh"));
        assertThrows(AppException.class, () -> client.identify(valid("subject1"), "synthetic-code", AppleClient.sha256(NONCE)));
        when(transport.exchange(anyString(), anyString())).thenReturn(json.createObjectNode().put("id_token", valid("subject1")));
        assertThrows(AppException.class, () -> client.identify(valid("subject1"), "synthetic-code", AppleClient.sha256(NONCE)));
    }
    @Test void refreshTokenEncryptionBindsSubjectAndClientAndRejectsTampering() {
        var cipher = new AppleTokenCipher(config);
        String first = cipher.encrypt("synthetic-refresh", "subject1"), second = cipher.encrypt("synthetic-refresh", "subject1");
        assertNotEquals(first, second); assertFalse(first.contains("synthetic-refresh"));
        assertEquals("synthetic-refresh", cipher.decrypt(first, "subject1"));
        assertThrows(IllegalStateException.class, () -> cipher.decrypt(first, "subject2"));
        assertThrows(IllegalStateException.class, () -> cipher.decrypt(first.substring(0, first.length() - 4) + "AAAA", "subject1"));
        config.setClientId("different.app");
        assertThrows(IllegalStateException.class, () -> cipher.decrypt(first, "subject1"));
    }
    @Test void featureCannotStartWithMissingOrInvalidConfiguration() {
        config.validate();
        var empty = new AppleProperties(); assertDoesNotThrow(empty::validate);
        empty.setEnabled(true); assertThrows(IllegalStateException.class, empty::validate);
        config.setPrivateKey("invalid-private-key"); assertThrows(IllegalStateException.class, config::validate);
        config = configured(); config.setTokenEncryptionKey(Base64.getEncoder().encodeToString(new byte[16]));
        assertThrows(IllegalStateException.class, config::validate);
    }
    @Test void publicKeysOnlyComeFromAppleTransportAndUnknownIdsAreRateLimited() {
        var publicKey = (RSAPublicKey) rsa.getPublic();
        var node = json.createObjectNode(); node.putArray("keys").addObject().put("kty", "RSA").put("alg", "RS256").put("use", "sig")
            .put("kid", "synthetic-kid").put("n", unsigned(publicKey.getModulus())).put("e", unsigned(publicKey.getPublicExponent()));
        when(transport.publicKeys()).thenReturn(node);
        var actual = new ApplePublicKeys(transport);
        assertEquals(publicKey, actual.resolve("synthetic-kid"));
        assertEquals(publicKey, actual.resolve("synthetic-kid"));
        assertThrows(AppException.class, () -> actual.resolve("unknown"));
        assertThrows(AppException.class, () -> actual.resolve("https://attacker.invalid"));
        verify(transport, times(1)).publicKeys();
        var invalidKey = json.createObjectNode(); invalidKey.putArray("keys").addObject().put("kty", "oct").put("alg", "HS256").put("kid", "bad");
        assertThrows(AppException.class, () -> ApplePublicKeys.parse(invalidKey));
    }
    static String unsigned(BigInteger value) {
        byte[] bytes = value.toByteArray(); if (bytes[0] == 0) bytes = Arrays.copyOfRange(bytes, 1, bytes.length);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
