package com.newaveflow.dto.auth;
import jakarta.validation.constraints.*;
public record KakaoCompleteRequest(
    @NotBlank @Pattern(regexp="[a-f0-9-]{36}") String flowId,
    @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") String ticket,
    @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") String verifier
) {}
