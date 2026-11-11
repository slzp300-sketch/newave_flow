package app.newaveflow.mobile;
import android.content.Context;
import android.security.keystore.*;
import android.util.Base64;
import org.json.JSONObject;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import java.security.KeyStore;
import java.nio.charset.StandardCharsets;

// Widget-only credentials and snapshots; never share the app's login/refresh token.
final class WidgetStore {
    private static SecretKey key() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        String alias="newave.widget.v1";
        if(!store.containsAlias(alias)) {
            KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());
            generator.generateKey();
        }
        return (SecretKey)store.getKey(alias,null);
    }
    static synchronized JSONObject read(Context context) throws Exception {
        String saved=context.getSharedPreferences("newave_widget",Context.MODE_PRIVATE).getString("session",null);
        if(saved==null)return null;
        try {
            String[] parts=saved.split(":",2); Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));
            return new JSONObject(new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8));
        } catch(Exception error) { clear(context); return null; }
    }
    static synchronized void write(Context context,JSONObject value) throws Exception {
        byte[] bytes=value.toString().getBytes(StandardCharsets.UTF_8);
        if(bytes.length>131072)throw new IllegalArgumentException("Widget session too large");
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
        String saved=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(bytes),Base64.NO_WRAP);
        if(!context.getSharedPreferences("newave_widget",Context.MODE_PRIVATE).edit().putString("session",saved).commit())throw new IllegalStateException("Unable to save widget");
    }
    static synchronized void clear(Context context) throws Exception {
        if(!context.getSharedPreferences("newave_widget",Context.MODE_PRIVATE).edit().clear().commit())throw new IllegalStateException("Unable to clear widget");
    }
    static synchronized boolean replace(Context context,String token,JSONObject next) throws Exception {
        JSONObject current=read(context);
        if(current==null||!token.equals(current.optString("token")))return false;
        if(next!=null){
            long previous=current.optJSONObject("snapshot")==null?0:current.getJSONObject("snapshot").optLong("revision");
            long incoming=next.optJSONObject("snapshot")==null?0:next.getJSONObject("snapshot").optLong("revision");
            if(incoming<previous)return false;
            // Preserve the newest successful check marker when a later GET began before the check.
            if(current.has("lastCheckAt")&&current.optString("lastCheckAt").compareTo(next.optString("lastCheckAt"))>0)
                next.put("lastCheckAt",current.getString("lastCheckAt"));
        }
        if(next==null)clear(context);else write(context,next);return true;
    }
}
