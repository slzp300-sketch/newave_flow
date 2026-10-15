package com.newaveflow.dto.auth;
import jakarta.validation.constraints.*;
public record AppleStartRequest(
    @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") String challenge,
    @NotBlank @Pattern(regexp="ios") String platform,
    @Size(max=200) String currentPassword
) {}
