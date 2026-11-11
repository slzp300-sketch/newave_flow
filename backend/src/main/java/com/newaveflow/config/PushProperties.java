package com.newaveflow.config;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.security.*;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;

/** Environment-only provider configuration; all network delivery is opt-in and disabled by default. */
@Component @Getter
public class PushProperties {
    @Value("${PUSH_ENABLED:false}") private boolean enabled;
    @Value("${PUSH_IOS_ENABLED:false}") private boolean iosEnabled;
    @Value("${PUSH_ANDROID_ENABLED:false}") private boolean androidEnabled;
    @Value("${PUSH_APNS_TEAM_ID:}") private String apnsTeamId="";
    @Value("${PUSH_APNS_KEY_ID:}") private String apnsKeyId="";
    @Value("${PUSH_APNS_PRIVATE_KEY:}") private String apnsPrivateKey="";
    @Value("${PUSH_APNS_TOPIC:app.newaveflow.mobile}") private String apnsTopic="app.newaveflow.mobile";
    @Value("${PUSH_APNS_SANDBOX:false}") private boolean apnsSandbox;
    @Value("${PUSH_FCM_PROJECT_ID:}") private String fcmProjectId="";
    @Value("${PUSH_FCM_CLIENT_EMAIL:}") private String fcmClientEmail="";
    @Value("${PUSH_FCM_PRIVATE_KEY:}") private String fcmPrivateKey="";

    @PostConstruct public void validate() {
        if(!enabled) return;
        try {
            if(!iosEnabled && !androidEnabled) throw new IllegalArgumentException();
            if(iosEnabled) {
                if(!apnsTeamId.matches("[A-Z0-9]{10}") || !apnsKeyId.matches("[A-Z0-9]{10}") || !apnsTopic.equals("app.newaveflow.mobile")) throw new IllegalArgumentException();
                key(apnsPrivateKey,"EC");
            }
            if(androidEnabled) {
                if(!fcmProjectId.matches("[a-z][a-z0-9-]{4,28}[a-z0-9]") || !fcmClientEmail.matches("[^\\s@]+@[^\\s@]+\\.gserviceaccount\\.com")) throw new IllegalArgumentException();
                key(fcmPrivateKey,"RSA");
            }
        } catch(Exception ignored) { throw new IllegalStateException("Push configuration is incomplete; keep PUSH_ENABLED=false until provider setup is verified."); }
    }
    public boolean supports(String platform) { return enabled && ("IOS".equals(platform)?iosEnabled:"ANDROID".equals(platform)&&androidEnabled); }
    public static PrivateKey key(String pem,String algorithm) {
        try {
            if(pem==null || pem.length()>16384) throw new IllegalArgumentException();
            String base64=pem.replace("\\n","\n").replace("-----BEGIN PRIVATE KEY-----","").replace("-----END PRIVATE KEY-----","").replaceAll("\\s","");
            return KeyFactory.getInstance(algorithm).generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(base64)));
        } catch(Exception ignored) { throw new IllegalStateException("Invalid push signing key"); }
    }
}
