package com.newaveflow.service;
import java.net.URI;
import java.util.Map;

/** Injectable boundary. Unit tests use a fake implementation and never open a network socket. */
public interface PushHttp {
    record Response(int status,String body) {}
    Response post(URI uri,Map<String,String> headers,String body) throws Exception;
}
