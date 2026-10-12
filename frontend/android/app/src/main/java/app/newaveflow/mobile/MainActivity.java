package app.newaveflow.mobile;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NewaveSecureStoragePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
