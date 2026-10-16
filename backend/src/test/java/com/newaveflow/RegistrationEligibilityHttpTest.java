package com.newaveflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.newaveflow.dto.auth.RegisterRequest;
import com.newaveflow.entity.User;
import com.newaveflow.exception.AppException;
import com.newaveflow.repository.UserRepository;
import com.newaveflow.service.AuthService;
import com.newaveflow.service.RegistrationEligibility;
import java.util.Arrays;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:registration_eligibility_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@ActiveProfiles("test") @AutoConfigureMockMvc @DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class RegistrationEligibilityHttpTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired AuthService auth;
    @Autowired UserRepository users;

    @Test void oldOrUnconfirmedEmailSignupsAreRejectedBeforeSavingAndConfirmedSignupStillRequiresApproval() throws Exception {
        var request = new RegisterRequest();
        request.setName("가상 가입 대상 교사"); request.setEmail("eligibility@example.invalid");
        request.setPassword("Synthetic!2026");
        for (Boolean confirmed : Arrays.asList(null, false)) {
            request.setEligibilityConfirmed(confirmed);
            var failure = assertThrows(AppException.class, () -> auth.register(request));
            assertEquals(400, failure.getStatus().value());
            assertEquals(RegistrationEligibility.REQUIRED_MESSAGE, failure.getMessage());
            var body = (ObjectNode) json.valueToTree(request);
            if (confirmed == null) body.remove("eligibilityConfirmed");
            http.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(RegistrationEligibility.REQUIRED_MESSAGE));
            assertEquals(0, users.count());
        }
        request.setEligibilityConfirmed(true);
        http.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
            .andExpect(status().isCreated());
        var created = users.findByEmailIgnoreCase("eligibility@example.invalid").orElseThrow();
        assertFalse(created.isActive()); assertEquals(User.Role.TEACHER, created.getRole());
    }
}
