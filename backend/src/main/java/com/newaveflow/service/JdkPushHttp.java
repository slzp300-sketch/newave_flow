package com.newaveflow.service;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Component
public class JdkPushHttp implements PushHttp {
    private final com.newaveflow.config.PushProperties config;
    public JdkPushHttp(com.newaveflow.config.PushProperties config) { this.config=config; }
    private final HttpClient client=HttpClient.newBuilder().version(HttpClient.Version.HTTP_2)
            .connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
    @Override public Response post(URI uri,Map<String,String> headers,String body) throws Exception {
        if(!config.isEnabled()) throw new IllegalStateException("Push delivery is disabled");
        if(!"https".equals(uri.getScheme()) || uri.getUserInfo()!=null || uri.getPort()!=-1
                || !Set.of("api.push.apple.com","api.sandbox.push.apple.com","fcm.googleapis.com","oauth2.googleapis.com").contains(uri.getHost()))
            throw new IllegalArgumentException("Unsupported push origin");
        var builder=HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(10));
        headers.forEach(builder::header);
        var future=client.sendAsync(builder.POST(HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofByteArray());
        try {
            var response=future.get(15,TimeUnit.SECONDS);
            byte[] bytes=response.body();
            if(bytes.length>65536) throw new IllegalStateException("Oversized push response");
            return new Response(response.statusCode(),new String(bytes,StandardCharsets.UTF_8));
        } finally { if(!future.isDone())future.cancel(true); }
    }
}
