package com.newaveflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newaveflow.config.PushProperties;
import com.newaveflow.entity.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** Local in-memory synthetic signing keys and canned HTTP responses only; no sockets or provider accounts. */
class ProviderPushTransportTest {
    final ObjectMapper json=new ObjectMapper();
    record Call(URI uri,Map<String,String> headers,String body) {}
    static class FakeHttp implements PushHttp {
        final List<Call> calls=new ArrayList<>(); final Queue<Response> responses=new ArrayDeque<>();
        public Response post(URI uri,Map<String,String> headers,String body) {
            calls.add(new Call(uri,headers,body));
            return Optional.ofNullable(responses.poll()).orElseThrow(()->new IllegalStateException("Unexpected mocked request"));
        }
    }
    PushDevice device(String platform) { var d=new PushDevice();d.setPlatform(platform);d.setToken("a".repeat(64));return d; }
    Notification notice() { return Notification.builder().id(19L).title("PRIVATE_SYNTHETIC_TITLE").content("PRIVATE_SYNTHETIC_RECORD").targetPath("/tts").build(); }
    void set(PushProperties c,String name,Object value) { ReflectionTestUtils.setField(c,name,value); }
    PushProperties configured(String platform) throws Exception {
        var c=new PushProperties();set(c,"enabled",true);
        String algorithm="IOS".equals(platform)?"EC":"RSA";
        var generator=KeyPairGenerator.getInstance(algorithm);generator.initialize("EC".equals(algorithm)?256:2048);
        String pem="-----BEGIN PRIVATE KEY-----\n"+Base64.getEncoder().encodeToString(generator.generateKeyPair().getPrivate().getEncoded())+"\n-----END PRIVATE KEY-----";
        if("IOS".equals(platform)) {
            set(c,"iosEnabled",true);set(c,"apnsTeamId","SYNTHETIC1");set(c,"apnsKeyId","SYNTHETIC2");set(c,"apnsPrivateKey",pem);
        } else {
            set(c,"androidEnabled",true);set(c,"fcmProjectId","synthetic-project");set(c,"fcmClientEmail","synthetic@synthetic-project.iam.gserviceaccount.com");set(c,"fcmPrivateKey",pem);
        }
        c.validate();return c;
    }
    @Test void defaultsCannotReachAnyProviderEvenIfDeviceExists() {
        var c=new PushProperties();c.validate();var http=new FakeHttp();var transport=new ProviderPushTransport(c,json,http);
        assertFalse(transport.available());assertEquals(PushTransport.Result.DISABLED,transport.send(device("IOS"),notice()));assertTrue(http.calls.isEmpty());
    }
    @Test void incompleteConfigurationFailsWithoutEchoingSecrets() {
        var c=new PushProperties();set(c,"enabled",true);set(c,"iosEnabled",true);set(c,"apnsPrivateKey","SYNTHETIC_PRIVATE_VALUE");
        var error=assertThrows(IllegalStateException.class,c::validate);assertFalse(error.getMessage().contains("SYNTHETIC_PRIVATE_VALUE"));
    }
    @Test void appleUsesAlertHeadersGenericTextAndVerifiedNotificationIdentifierOnly() throws Exception {
        var c=configured("IOS");var http=new FakeHttp();http.responses.addAll(List.of(new PushHttp.Response(200,""),new PushHttp.Response(200,"")));
        var transport=new ProviderPushTransport(c,json,http);assertTrue(transport.available("IOS"));assertFalse(transport.available("ANDROID"));
        assertEquals(PushTransport.Result.SENT,transport.send(device("IOS"),notice()));
        var call=http.calls.get(0);assertEquals("api.push.apple.com",call.uri().getHost());assertEquals("alert",call.headers().get("apns-push-type"));
        assertEquals("app.newaveflow.mobile",call.headers().get("apns-topic"));assertEquals("notification-19",call.headers().get("apns-collapse-id"));
        var body=json.readTree(call.body());assertEquals("19",body.path("notificationId").asText());assertFalse(call.body().contains("PRIVATE_SYNTHETIC"));assertFalse(body.has("targetPath"));
        var parts=call.headers().get("authorization").substring(7).split("\\.");
        assertEquals("ES256",json.readTree(Base64.getUrlDecoder().decode(parts[0])).path("alg").asText());
        assertEquals("SYNTHETIC1",json.readTree(Base64.getUrlDecoder().decode(parts[1])).path("iss").asText());
        assertEquals(PushTransport.Result.SENT,transport.send(device("IOS"),notice()));
        assertEquals(call.headers().get("authorization"),http.calls.get(1).headers().get("authorization"));
    }
    @Test void appleInvalidTokensDisableDevicesButTransientErrorsRetry() throws Exception {
        var http=new FakeHttp();http.responses.addAll(List.of(new PushHttp.Response(410,"{\"reason\":\"Unregistered\"}"),new PushHttp.Response(429,""),new PushHttp.Response(403,"{\"reason\":\"InvalidProviderToken\"}")));
        var transport=new ProviderPushTransport(configured("IOS"),json,http);
        assertEquals(PushTransport.Result.INVALID_DEVICE,transport.send(device("IOS"),notice()));
        assertEquals(PushTransport.Result.RETRY,transport.send(device("IOS"),notice()));
        assertEquals(PushTransport.Result.FAILED,transport.send(device("IOS"),notice()));
    }
    @Test void googleUsesOAuthV1AndCachesOnlyShortLivedAccessToken() throws Exception {
        var http=new FakeHttp();http.responses.addAll(List.of(new PushHttp.Response(200,"{\"access_token\":\"synthetic-access\",\"expires_in\":3600}"),new PushHttp.Response(200,"{}"),new PushHttp.Response(200,"{}")));
        var transport=new ProviderPushTransport(configured("ANDROID"),json,http);
        assertEquals(PushTransport.Result.SENT,transport.send(device("ANDROID"),notice()));assertEquals(PushTransport.Result.SENT,transport.send(device("ANDROID"),notice()));
        assertEquals(3,http.calls.size());assertEquals("oauth2.googleapis.com",http.calls.get(0).uri().getHost());
        assertEquals("fcm.googleapis.com",http.calls.get(1).uri().getHost());assertEquals("Bearer synthetic-access",http.calls.get(1).headers().get("Authorization"));
        var payload=json.readTree(http.calls.get(1).body()).path("message");assertEquals("19",payload.path("data").path("notificationId").asText());
        assertFalse(http.calls.get(1).body().contains("PRIVATE_SYNTHETIC"));assertEquals("notification-19",payload.path("android").path("notification").path("tag").asText());
        String assertion=URLDecoder.decode(http.calls.get(0).body().split("assertion=",2)[1],StandardCharsets.UTF_8);
        assertEquals("RS256",json.readTree(Base64.getUrlDecoder().decode(assertion.split("\\.")[0])).path("alg").asText());
    }
    @Test void googleUnregisteredTokenIsPermanentAndServerFailureIsRetryable() throws Exception {
        var http=new FakeHttp();http.responses.addAll(List.of(new PushHttp.Response(200,"{\"access_token\":\"synthetic-access\",\"expires_in\":3600}"),
                new PushHttp.Response(404,"{\"error\":{\"details\":[{\"errorCode\":\"UNREGISTERED\"}]}}"),new PushHttp.Response(503,"")));
        var transport=new ProviderPushTransport(configured("ANDROID"),json,http);
        assertEquals(PushTransport.Result.INVALID_DEVICE,transport.send(device("ANDROID"),notice()));assertEquals(PushTransport.Result.RETRY,transport.send(device("ANDROID"),notice()));
    }
    @Test void providerExceptionsNeverExposeTheirContentsToTheCaller() throws Exception {
        PushHttp fake=(uri,headers,body)->{throw new java.io.IOException("SYNTHETIC_SECRET_SHOULD_NOT_ESCAPE");};
        assertEquals(PushTransport.Result.RETRY,new ProviderPushTransport(configured("IOS"),json,fake).send(device("IOS"),notice()));
    }
}
