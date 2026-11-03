package com.newaveflow.config;
import java.time.*;
import org.springframework.context.annotation.*;
@Configuration
public class PraiseClockConfig {
 @Bean public Clock praiseClock(){return Clock.system(ZoneId.of("Asia/Seoul"));}
}
