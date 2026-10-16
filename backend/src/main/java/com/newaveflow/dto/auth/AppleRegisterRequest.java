package com.newaveflow.dto.auth;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
@Getter @Setter
public class AppleRegisterRequest {
    @NotBlank @Size(max=50) private String name;
    @Size(max=20) private String phone;
    @NotBlank @Pattern(regexp="[a-f0-9-]{36}") private String flowId;
    @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") private String ticket;
    @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") private String verifier;
}
