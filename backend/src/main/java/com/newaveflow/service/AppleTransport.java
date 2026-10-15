package com.newaveflow.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.config.AppleProperties;
import com.newaveflow.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@Component @RequiredArgsConstructor
public class AppleTransport {
    private final AppleProperties config;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
        .followRedirects(HttpClient.Redirect.NEVER).build();

    public JsonNode publicKeys() { return send("/auth/keys", null); }
    public JsonNode exchange(String code, String clientSecret) {
        // Native AuthenticationServices does not supply a redirect_uri.
        return send("/auth/token", credentials(clientSecret) + "&grant_type=authorization_code&code=" + encode(code));
    }
    public void revoke(String refreshToken, String clientSecret) {
        send("/auth/revoke", credentials(clientSecret) + "&token_type_hint=refresh_token&token=" + encode(refreshToken));
    }
    private String credentials(String secret) { return "client_id=" + encode(config.getClientId()) + "&client_secret=" + encode(secret); }
    private JsonNode send(String path, String body) {
        try {
            var builder = HttpRequest.newBuilder(URI.create("https://appleid.apple.com" + path)).timeout(Duration.ofSeconds(10));
            if (body == null) builder.GET();
            else builder.header("Content-Type", "application/x-www-form-urlencoded;charset=utf-8").POST(HttpRequest.BodyPublishers.ofString(body));
            var response = http.send(builder.build(), HttpResponse.BodyHandlers.ofInputStream());
            try (var stream = response.body()) {
                byte[] bytes = stream.readNBytes(65537);
                if (response.statusCode() != 200 || bytes.length > 65536) throw new IllegalStateException();
                if (path.equals("/auth/revoke") && bytes.length == 0) return json.createObjectNode();
                JsonNode result = json.readTree(bytes);
                if (result == null || !result.isObject() || result.has("error")) throw new IllegalStateException();
                return result;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw AppException.badRequest("Apple 연결이 중단됐어요. 다시 시도해 주세요.");
        } catch (Exception e) {
            // Never include provider responses, private keys, codes, or tokens in errors/logs.
            throw AppException.badRequest("Apple 인증 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
        }
    }
    private static String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
}
