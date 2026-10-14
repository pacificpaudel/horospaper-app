package com.horospaper.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.horospaper.app.widgets.WidgetsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugin (home-screen widgets); registered before the bridge starts.
        registerPlugin(WidgetsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
