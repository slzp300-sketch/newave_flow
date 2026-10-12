package com.newaveflow;

import com.newaveflow.entity.*;
import com.newaveflow.repository.*;
import com.newaveflow.security.JwtTokenProvider;
import com.newaveflow.service.EventReadVersion;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class EventReadHttpTest {
    @Autowired MockMvc http;
    @Autowired UserRepository users;
    @Autowired EventRepository events;
    @Autowired JwtTokenProvider tokens;
    String token(User user) { return "Bearer "+tokens.createAccessToken(user.getId(),user.getEmail(),user.getRole().name()); }

    @Test void authenticatedDevicesShareStatusWithoutAcceptingAnotherUserId() throws Exception {
        var a=users.saveAndFlush(User.builder().name("검수 A").email("read-a@example.invalid").password("synthetic").role(User.Role.TEACHER).build());
        var b=users.saveAndFlush(User.builder().name("검수 B").email("read-b@example.invalid").password("synthetic").role(User.Role.TEACHER).build());
        var event=events.saveAndFlush(Event.builder().title("가상 일정").eventDate(LocalDate.of(2026,10,17)).eventType(Event.EventType.SPECIAL).build());
        var version=EventReadVersion.of(event);
        var route="/api/event-reads/"+event.getId();
        http.perform(get("/api/event-reads")).andExpect(status().isUnauthorized());
        http.perform(put(route).contentType("application/json").content("{\"version\":\""+version+"\"}")).andExpect(status().isUnauthorized());
        http.perform(put(route).header("Authorization",token(a)).contentType("application/json")
                .content("{\"version\":\""+version+"\",\"userId\":"+b.getId()+"}"))
                .andExpect(status().isOk());
        // A fresh access token represents the same account on a different device.
        http.perform(get("/api/event-reads").header("Authorization",token(a)))
                .andExpect(status().isOk()).andExpect(jsonPath("$['"+event.getId()+"']").value(version));
        http.perform(get("/api/event-reads").header("Authorization",token(b)).param("userId",a.getId().toString()))
                .andExpect(status().isOk()).andExpect(content().json("{}"));
        http.perform(put(route).header("Authorization",token(a)).contentType("application/json").content("{\"version\":\"invalid\"}"))
                .andExpect(status().isBadRequest());
        event.setTitle("변경된 가상 일정"); events.flush();
        http.perform(put(route).header("Authorization",token(a)).contentType("application/json").content("{\"version\":\""+version+"\"}"))
                .andExpect(status().isConflict());
    }
}
