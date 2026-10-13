package com.newaveflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.config.KakaoProperties;
import com.newaveflow.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@Component @RequiredArgsConstructor
public class KakaoClient {
    private final KakaoProperties config;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();

    public String identify(String code) {
        try {
            String body = "grant_type=authorization_code&client_id=" + encode(config.getClientId()) + "&client_secret=" + encode(config.getClientSecret())
                + "&redirect_uri=" + encode(config.getRedirectUri()) + "&code=" + encode(code);
            var tokenRequest = HttpRequest.newBuilder(URI.create("https://kauth.kakao.com/oauth/token")).timeout(Duration.ofSeconds(8))
                .header("Content-Type", "application/x-www-form-urlencoded;charset=utf-8").POST(HttpRequest.BodyPublishers.ofString(body)).build();
            var token = http.send(tokenRequest, HttpResponse.BodyHandlers.ofString());
            if (token.statusCode() != 200) throw new IllegalStateException();
            String access = json.readTree(token.body()).path("access_token").asText();
            if (access.isBlank()) throw new IllegalStateException();
            var identityRequest = HttpRequest.newBuilder(URI.create("https://kapi.kakao.com/v2/user/me")).timeout(Duration.ofSeconds(8))
                .header("Authorization", "Bearer " + access).GET().build();
            var identity = http.send(identityRequest, HttpResponse.BodyHandlers.ofString());
            if (identity.statusCode() != 200) throw new IllegalStateException();
            String id = json.readTree(identity.body()).path("id").asText();
            if (!id.matches("[1-9][0-9]{0,99}")) throw new IllegalStateException();
            return id;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw AppException.badRequest("카카오 연결이 중단됐어요. 다시 시도해 주세요.");
        } catch (Exception e) {
            // Provider tokens, authorization codes and response bodies are never logged.
            throw AppException.badRequest("카카오 인증을 완료하지 못했어요. 다시 시도해 주세요.");
        }
    }
    public static String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
}
