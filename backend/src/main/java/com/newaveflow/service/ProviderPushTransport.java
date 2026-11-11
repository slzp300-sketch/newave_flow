package com.newaveflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.config.PushProperties;
import com.newaveflow.entity.*;
import io.jsonwebtoken.Jwts;
import org.springframework.stereotype.Component;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;

/** Fixed provider origins; generic lock-screen copy; no token, response body or key logging. */
@Component
public class ProviderPushTransport implements PushTransport {
    private final PushProperties config;
    private final ObjectMapper json;
    private final PushHttp http;
    private String appleToken;
    private Instant appleTokenUntil=Instant.EPOCH;
    private String googleToken;
    private Instant googleTokenUntil=Instant.EPOCH;
    public ProviderPushTransport(PushProperties config,ObjectMapper json,PushHttp http) { this.config=config; this.json=json; this.http=http; }
    public boolean available() { return config.isEnabled() && (config.isIosEnabled() || config.isAndroidEnabled()); }
    public boolean available(String platform) { return config.supports(platform); }
    @Override public Result send(PushDevice device,Notification notification) {
        if(!config.supports(device.getPlatform())) return Result.DISABLED;
        try { return "IOS".equals(device.getPlatform()) ? apple(device,notification) : google(device,notification); }
        catch(InterruptedException ignored) { Thread.currentThread().interrupt(); return Result.RETRY; }
        catch(Exception ignored) { return Result.RETRY; }
    }
    private Result apple(PushDevice device,Notification n) throws Exception {
        Instant now=Instant.now();
        String jwt=appleToken(now);
        String origin=config.isApnsSandbox()?"https://api.sandbox.push.apple.com":"https://api.push.apple.com";
        var body=Map.of("aps",Map.of("alert",Map.of("title","뉴웨이브 플로우","body","새 알림이 있습니다. 앱에서 확인해주세요."),"sound","default"),
                "notificationId",n.getId().toString());
        Map<String,String> headers=Map.of("authorization","bearer "+jwt,"apns-topic",config.getApnsTopic(),"apns-push-type","alert",
                "apns-priority","10","apns-expiration",Long.toString(now.plusSeconds(3600).getEpochSecond()),
                "apns-collapse-id","notification-"+n.getId(),"content-type","application/json");
        var response=http.post(URI.create(origin+"/3/device/"+device.getToken()),headers,json.writeValueAsString(body));
        if(response.status()==200) return Result.SENT;
        if(retry(response.status())) return Result.RETRY;
        if(response.status()==410) return Result.INVALID_DEVICE;
        String reason=json.readTree(response.body()).path("reason").asText();
        if(Set.of("BadDeviceToken","Unregistered").contains(reason)) return Result.INVALID_DEVICE;
        return Result.FAILED;
    }
    private synchronized String appleToken(Instant now) {
        // APNs rejects excessively frequent provider-token rotation; cache within its one-hour validity.
        if(appleToken!=null && now.isBefore(appleTokenUntil)) return appleToken;
        appleToken=Jwts.builder().header().keyId(config.getApnsKeyId()).and().issuer(config.getApnsTeamId()).issuedAt(Date.from(now))
                .signWith(PushProperties.key(config.getApnsPrivateKey(),"EC"),Jwts.SIG.ES256).compact();
        appleTokenUntil=now.plusSeconds(3000);
        return appleToken;
    }
    private Result google(PushDevice device,Notification n) throws Exception {
        String id=n.getId().toString();
        var body=Map.of("message",Map.of("token",device.getToken(),"notification",Map.of("title","뉴웨이브 플로우","body","새 알림이 있습니다. 앱에서 확인해주세요."),
                "data",Map.of("notificationId",id),"android",Map.of("priority","HIGH","ttl","3600s","notification",Map.of("tag","notification-"+id))));
        var response=http.post(URI.create("https://fcm.googleapis.com/v1/projects/"+config.getFcmProjectId()+"/messages:send"),
                Map.of("Authorization","Bearer "+googleToken(),"Content-Type","application/json"),json.writeValueAsString(body));
        if(response.status()==200) return Result.SENT;
        if(response.status()==401) { synchronized(this) { googleTokenUntil=Instant.EPOCH; } return Result.RETRY; }
        if(retry(response.status())) return Result.RETRY;
        var details=json.readTree(response.body()).path("error").path("details");
        if(details.isArray()) for(var detail:details) if("UNREGISTERED".equals(detail.path("errorCode").asText())) return Result.INVALID_DEVICE;
        return Result.FAILED;
    }
    private synchronized String googleToken() throws Exception {
        Instant now=Instant.now();
        if(googleToken!=null && now.isBefore(googleTokenUntil)) return googleToken;
        String assertion=Jwts.builder().issuer(config.getFcmClientEmail()).claim("scope","https://www.googleapis.com/auth/firebase.messaging")
                .audience().add("https://oauth2.googleapis.com/token").and().issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(3600)))
                .signWith(PushProperties.key(config.getFcmPrivateKey(),"RSA"),Jwts.SIG.RS256).compact();
        String body="grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion="+URLEncoder.encode(assertion,StandardCharsets.UTF_8);
        var response=http.post(URI.create("https://oauth2.googleapis.com/token"),Map.of("Content-Type","application/x-www-form-urlencoded"),body);
        if(response.status()!=200) throw new IllegalStateException("Push provider authorization unavailable");
        var tree=json.readTree(response.body()); String token=tree.path("access_token").asText();
        if(token.isBlank() || token.length()>16384) throw new IllegalStateException("Push provider authorization unavailable");
        googleToken=token; googleTokenUntil=now.plusSeconds(Math.max(30,Math.min(3300,tree.path("expires_in").asLong(300)-60)));
        return token;
    }
    private static boolean retry(int status) { return status==429 || status>=500; }
}
