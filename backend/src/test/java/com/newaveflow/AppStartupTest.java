package com.newaveflow;

import com.newaveflow.config.DataInitService;
import com.newaveflow.config.RosterDataInitService;
import com.newaveflow.config.TtsDataInitializer;
import com.newaveflow.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:startup;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@ActiveProfiles("test")
class AppStartupTest {
    @Autowired ApplicationContext context;
    @Autowired UserRepository users;

    @Test void fullApplicationStartsWithoutRosterOrAccountSeeding() {
        assertTrue(context.getBeansOfType(DataInitService.class).isEmpty());
        assertTrue(context.getBeansOfType(RosterDataInitService.class).isEmpty());
        assertTrue(context.getBeansOfType(TtsDataInitializer.class).isEmpty());
        assertEquals(0, users.count());
    }
}
