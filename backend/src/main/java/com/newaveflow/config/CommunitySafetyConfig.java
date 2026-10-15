package com.newaveflow.config;

import com.newaveflow.entity.User;
import com.newaveflow.service.CommunitySafetyService;
import jakarta.servlet.http.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.*;
import java.util.Set;

@Configuration @RequiredArgsConstructor
public class CommunitySafetyConfig implements WebMvcConfigurer {
    private final CommunitySafetyService safety;
    @Override public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
                if (!(handler instanceof HandlerMethod) || !Set.of("POST", "PUT", "PATCH").contains(request.getMethod())) return true;
                var authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.getPrincipal() instanceof User user) safety.requireAgreement(user.getId());
                return true;
            }
        }).addPathPatterns("/api/**").excludePathPatterns("/api/auth/**", "/api/safety/**", "/api/notifications/**",
            "/api/event-reads/**", "/api/users/me/password", "/api/users/me/settings", "/api/users/me/kakao/**",
            "/api/users/me/apple/**", "/api/account-deletion/**");
    }
}
