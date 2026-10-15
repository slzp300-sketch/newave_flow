package com.newaveflow.config;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import java.security.KeyFactory;
import java.security.interfaces.ECPrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;

@Component @ConfigurationProperties(prefix = "apple") @Getter @Setter
public class AppleProperties {
    private boolean enabled;
    private String clientId = "";
    private String teamId = "";
    private String keyId = "";
    private String privateKey = "";
    private String tokenEncryptionKey = "";

    @PostConstruct public void validate() {
        if (!enabled) return;
        if (!clientId.matches("[A-Za-z0-9][A-Za-z0-9.-]{2,199}") || !teamId.matches("[A-Z0-9]{10}") || !keyId.matches("[A-Z0-9]{10}")) {
            throw new IllegalStateException("Apple client, team and key identifiers are required when enabled.");
        }
        signingKey();
        encryptionKey();
    }

    public ECPrivateKey signingKey() {
        try {
            String pem = privateKey.replace("\\n", "\n").replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "").replaceAll("\\s", "");
            var key = (ECPrivateKey) KeyFactory.getInstance("EC").generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(pem)));
            if (key.getParams().getCurve().getField().getFieldSize() != 256) throw new IllegalArgumentException();
            return key;
        } catch (Exception e) { throw new IllegalStateException("A valid Apple P-256 signing key is required."); }
    }

    public byte[] encryptionKey() {
        try {
            byte[] key = Base64.getDecoder().decode(tokenEncryptionKey);
            if (key.length != 32) throw new IllegalArgumentException();
            return key;
        } catch (Exception e) { throw new IllegalStateException("Apple token encryption requires a separate base64-encoded 32-byte key."); }
    }
}
