package com.newaveflow.config;

import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

@Component
public class RuntimeProfileGuard {
    public RuntimeProfileGuard(Environment environment) {
        if (!environment.acceptsProfiles(Profiles.of("prod", "dev", "local", "test"))) {
            throw new IllegalStateException("Set SPRING_PROFILES_ACTIVE explicitly (prod, dev, or local)");
        }
    }
}
