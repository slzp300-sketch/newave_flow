package com.newaveflow.dto.auth;
import jakarta.validation.constraints.*;
public record KakaoStartRequest(
    @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") String challenge,
    @NotBlank @Pattern(regexp="web|android") String platform,
    @Size(max=200) String currentPassword
) {}
