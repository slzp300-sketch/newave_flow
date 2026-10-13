package app.newaveflow.mobile;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.os.Build;
import androidx.core.splashscreen.SplashScreen;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            SplashScreen.installSplashScreen(this);
        }
        registerPlugin(NewaveSecureStoragePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
