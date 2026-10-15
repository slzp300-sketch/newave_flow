package com.newaveflow.service;

import com.newaveflow.config.AppleProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

@Component @RequiredArgsConstructor
public class AppleTokenCipher {
    private final AppleProperties config;
    private static final SecureRandom RANDOM = new SecureRandom();
    public String encrypt(String token, String subject) {
        try {
            if (token == null || token.isBlank() || token.length() > 16384) throw new IllegalArgumentException();
            byte[] nonce = new byte[12]; RANDOM.nextBytes(nonce);
            var cipher = cipher(Cipher.ENCRYPT_MODE, nonce, subject);
            return "v1." + Base64.getUrlEncoder().withoutPadding().encodeToString(nonce) + "."
                + Base64.getUrlEncoder().withoutPadding().encodeToString(cipher.doFinal(token.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) { throw new IllegalStateException("Apple credentials could not be protected."); }
    }
    public String decrypt(String value, String subject) {
        try {
            String[] parts = value.split("\\.", -1);
            if (parts.length != 3 || !"v1".equals(parts[0])) throw new IllegalArgumentException();
            byte[] nonce = Base64.getUrlDecoder().decode(parts[1]);
            if (nonce.length != 12) throw new IllegalArgumentException();
            return new String(cipher(Cipher.DECRYPT_MODE, nonce, subject).doFinal(Base64.getUrlDecoder().decode(parts[2])), StandardCharsets.UTF_8);
        } catch (Exception e) { throw new IllegalStateException("Apple credentials could not be opened."); }
    }
    private Cipher cipher(int mode, byte[] nonce, String subject) throws Exception {
        if (subject == null || subject.isBlank()) throw new IllegalArgumentException();
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(mode, new SecretKeySpec(config.encryptionKey(), "AES"), new GCMParameterSpec(128, nonce));
        cipher.updateAAD(("newave-apple-v1:" + config.getClientId() + ":" + subject).getBytes(StandardCharsets.UTF_8));
        return cipher;
    }
}
