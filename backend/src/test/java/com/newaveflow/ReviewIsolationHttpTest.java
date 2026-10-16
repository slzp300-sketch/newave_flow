package com.newaveflow;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.config.*;
import com.newaveflow.controller.*;
import com.newaveflow.entity.User;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.*;
import java.nio.file.Path;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.annotation.*;
import org.springframework.http.*;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.client.*;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ReviewIsolationHttpTest {
    private static final String KEY = "synthetic-review-and-production-same-key-proves-issuer-boundary-12345";
    private static final String PASSWORD = "SyntheticReviewPassword!2026";
    @TempDir Path dataDirectory;
    private final ObjectMapper json = new ObjectMapper();

    private ServletWebServerApplicationContext startReview() {
        return (ServletWebServerApplicationContext) new SpringApplicationBuilder(NewaveFlowApplication.class)
                .profiles("review").properties(Map.of(
                    "REVIEW_DATA_DIR", dataDirectory.toString().replace('\\', '/'),
                    "REVIEW_JWT_SECRET", KEY, "REVIEW_DATABASE_PASSWORD", PASSWORD,
                    "REVIEW_TEACHER_PASSWORD", PASSWORD, "REVIEW_ADMIN_PASSWORD", PASSWORD))
                .run("--server.port=0", "--spring.main.banner-mode=off", "--logging.level.root=ERROR");
    }
    private HttpEntity<?> request(Object body, String token) {
        var headers = new HttpHeaders(); headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) headers.setBearerAuth(token);
        return new HttpEntity<>(body, headers);
    }
    private JsonNode login(RestTemplate http, String base, String email) throws Exception {
        return json.readTree(http.postForObject(base + "/auth/login", request(Map.of("email", email, "password", PASSWORD), null), String.class));
    }

    @Configuration @EnableWebMvc @Import({SecurityConfig.class, com.newaveflow.exception.GlobalExceptionHandler.class})
    static class SyntheticProduction {
        @Bean UserRepository users() {
            User user = User.builder().id(1L).name("운영 경계 검사 가상 교사").email("synthetic@example.invalid")
                    .password(new BCryptPasswordEncoder().encode(PASSWORD)).role(User.Role.TEACHER).isActive(true).build();
            var repository = mock(UserRepository.class);
            when(repository.findById(1L)).thenReturn(Optional.of(user));
            return repository;
        }
        @Bean JwtTokenProvider provider() { return new JwtTokenProvider(KEY, 3600000, 604800000); }
        @Bean StudentService students() { return mock(StudentService.class); }
        @Bean StudentController studentController(StudentService students) { return new StudentController(students); }
        @Bean AuthService auth(UserRepository users, JwtTokenProvider tokens) { return new AuthService(users, new BCryptPasswordEncoder(), tokens); }
        @Bean AuthController authController(AuthService auth) { return new AuthController(auth); }
    }

    @Test void realReviewHttpUsesOnlySyntheticDatabaseAndRejectsProductionTokensAcrossReadsWritesAndRefresh() throws Exception {
        try (var review = startReview(); var production = new AnnotationConfigWebApplicationContext()) {
            assertTrue(review.getBeansOfType(DataInitService.class).isEmpty());
            assertTrue(review.getBeansOfType(RosterDataInitService.class).isEmpty());
            assertTrue(review.getBeansOfType(TtsDataInitializer.class).isEmpty());
            assertEquals(8, review.getBean(StudentRepository.class).count());
            assertTrue(review.getBean(StudentRepository.class).findAll().stream().allMatch(s -> s.getName().startsWith("가상학생")));
            String base = "http://localhost:" + review.getWebServer().getPort() + "/api";
            var http = new RestTemplate();
            JsonNode session = login(http, base, ReviewFixtures.TEACHER_EMAIL);
            assertEquals(1, session.at("/user/id").asLong());
            String teacher = session.get("accessToken").asText();
            http.postForObject(base + "/safety/agreement", request(Map.of("version", CommunitySafetyService.POLICY_VERSION, "accepted", true), teacher), String.class);
            String admin = login(http, base, ReviewFixtures.ADMIN_EMAIL).get("accessToken").asText();
            JsonNode deletionAccount = login(http, base, ReviewFixtures.DELETION_EMAIL);
            assertNotEquals(session.at("/user/id"), deletionAccount.at("/user/id"));
            JsonNode deletionReceipt = json.readTree(http.postForObject(base + "/auth/account-deletion",
                request(Map.of("email", ReviewFixtures.DELETION_EMAIL, "password", PASSWORD, "confirmed", true), null), String.class));
            assertEquals("REQUESTED", deletionReceipt.path("status").asText());
            assertFalse(deletionReceipt.has("accessToken"));
            assertTrue(review.getBean(AccountDeletionRequestRepository.class).findByUserId(deletionAccount.at("/user/id").asLong()).isPresent());
            assertTrue(review.getBean(AccountDeletionRequestRepository.class).findByUserId(session.at("/user/id").asLong()).isEmpty());
            assertNotNull(login(http, base, ReviewFixtures.TEACHER_EMAIL).get("accessToken"));
            assertTrue(http.exchange(base + "/students/my-class", HttpMethod.GET, request(null, teacher), String.class).getBody().contains("가상학생"));
            assertThrows(HttpClientErrorException.Unauthorized.class, () -> http.getForObject(base + "/students/1", String.class));
            assertEquals(200, http.exchange(base + "/users/me/profile", HttpMethod.PUT, request(Map.of("name", "가상 교사 수정"), teacher), String.class).getStatusCode().value());
            assertEquals("가상 교사 수정", review.getBean(UserRepository.class).findById(1L).orElseThrow().getName());

            production.setServletContext(new MockServletContext()); production.register(SyntheticProduction.class); production.refresh();
            var mvc = MockMvcBuilders.webAppContextSetup(production).apply(springSecurity()).build();
            JwtTokenProvider prodTokens = production.getBean(JwtTokenProvider.class);
            String prodAccess = prodTokens.createAccessToken(1L, "synthetic@example.invalid", "TEACHER");
            String prodRefresh = prodTokens.createRefreshToken(1L, "synthetic@example.invalid", "TEACHER");
            for (String token : new String[]{teacher, admin}) {
                mvc.perform(get("/api/students/1").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
                mvc.perform(patch("/api/students/1/deactivate").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
                mvc.perform(post("/api/auth/refresh").contentType("application/json").content(json.writeValueAsString(Map.of("refreshToken", session.get("refreshToken").asText())))).andExpect(status().isUnauthorized());
            }
            verifyNoInteractions(production.getBean(StudentService.class));
            assertEquals("운영 경계 검사 가상 교사", production.getBean(UserRepository.class).findById(1L).orElseThrow().getName());
            for (String route : new String[]{"/students/1", "/users/me", "/admin/users/pending"}) {
                assertThrows(HttpClientErrorException.Unauthorized.class, () -> http.exchange(base + route, HttpMethod.GET, request(null, prodAccess), String.class));
            }
            assertThrows(HttpClientErrorException.Unauthorized.class, () -> http.exchange(base + "/users/me/profile", HttpMethod.PUT, request(Map.of("name", "crossing"), prodAccess), String.class));
            assertThrows(HttpClientErrorException.Unauthorized.class, () -> http.postForObject(base + "/auth/refresh", request(Map.of("refreshToken", prodRefresh), null), String.class));
            assertEquals("가상 교사 수정", review.getBean(UserRepository.class).findById(1L).orElseThrow().getName());
            assertEquals(8, review.getBean(StudentRepository.class).count());
        } finally { SecurityContextHolder.clearContext(); }
        try (var restarted = startReview()) {
            assertEquals(8, restarted.getBean(StudentRepository.class).count());
            assertEquals("가상 교사 수정", restarted.getBean(UserRepository.class).findById(1L).orElseThrow().getName());
            String base = "http://localhost:" + restarted.getWebServer().getPort() + "/api";
            assertEquals("가상 교사 수정", login(new RestTemplate(), base, ReviewFixtures.TEACHER_EMAIL).at("/user/name").asText());
        }
    }
}
