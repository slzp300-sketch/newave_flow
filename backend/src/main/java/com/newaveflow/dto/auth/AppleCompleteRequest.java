package com.newaveflow.dto.auth;
import jakarta.validation.constraints.*;
public record AppleCompleteRequest(
    @NotBlank @Pattern(regexp="[a-f0-9-]{36}") String flowId,
    @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") String state,
    @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") String verifier,
    @NotBlank @Size(max=16384) String identityToken,
    @NotBlank @Size(max=4096) String authorizationCode
) {}
