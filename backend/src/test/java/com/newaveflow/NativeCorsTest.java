package com.newaveflow;

import com.newaveflow.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import static org.junit.jupiter.api.Assertions.*;

class NativeCorsTest {
    @Test void onlyExactNativeAndExistingWebOriginsAreAllowed() {
        var config = new SecurityConfig(null, null).corsConfigurationSource()
            .getCorsConfiguration(new MockHttpServletRequest("OPTIONS", "/api/auth/login"));
        assertNotNull(config);
        assertEquals("https://localhost", config.checkOrigin("https://localhost"));
        assertEquals("https://newave-flow.vercel.app", config.checkOrigin("https://newave-flow.vercel.app"));
        assertNull(config.checkOrigin("http://localhost"));
        assertNull(config.checkOrigin("https://localhost.attacker.invalid"));
        assertNull(config.checkOrigin("https://attacker.invalid"));
    }
}
