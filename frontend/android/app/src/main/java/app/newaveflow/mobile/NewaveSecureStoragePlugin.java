package app.newaveflow.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "NewaveSecureStorage")
public class NewaveSecureStoragePlugin extends Plugin {
    private static final String KEY = "newave-auth";
    private static final String ALIAS = "newave.session.v1";
    private SharedPreferences preferences() {
        return getContext().getSharedPreferences("newave_secure_session", Context.MODE_PRIVATE);
    }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (!store.containsAlias(ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(ALIAS, null);
    }
    private boolean validate(PluginCall call) {
        if (KEY.equals(call.getString("key")) || "newave-kakao-pending".equals(call.getString("key"))) return true;
        call.reject("Unsupported storage key");
        return false;
    }
    @PluginMethod public void get(PluginCall call) {
        if (!validate(call)) return;
        try {
            String storageKey = call.getString("key");
            String saved = preferences().getString(storageKey, null);
            JSObject result = new JSObject();
            if (saved != null) {
                String[] parts = saved.split(":", 2);
                if (parts.length != 2) throw new IllegalStateException("Invalid session format");
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
                result.put("value", new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8));
            }
            call.resolve(result);
        } catch (Exception error) {
            // Keys cannot follow a device restore. Discard unusable ciphertext, never use plaintext.
            if (preferences().edit().remove(call.getString("key")).commit()) call.resolve(new JSObject());
            else call.reject("Unable to read secure session");
        }
    }
    @PluginMethod public void set(PluginCall call) {
        if (!validate(call)) return;
        String value = call.getString("value");
        if (value == null || value.length() > 65536) { call.reject("Invalid session"); return; }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            String ciphertext = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":"
                + Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
            if (!preferences().edit().putString(call.getString("key"), ciphertext).commit()) throw new IllegalStateException();
            call.resolve();
        } catch (Exception error) { call.reject("Unable to save secure session"); }
    }
    @PluginMethod public void remove(PluginCall call) {
        if (!validate(call)) return;
        if (preferences().edit().remove(call.getString("key")).commit()) call.resolve();
        else call.reject("Unable to remove secure session");
    }
}
