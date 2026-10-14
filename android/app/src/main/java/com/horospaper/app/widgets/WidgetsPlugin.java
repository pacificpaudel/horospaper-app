package com.horospaper.app.widgets;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Lets the web app (NativeApp.tsx) redraw the home-screen widgets right away, e.g. once today's chart is made. */
@CapacitorPlugin(name = "Widgets")
public class WidgetsPlugin extends Plugin {
    @PluginMethod
    public void refresh(PluginCall call) {
        WidgetUpdater.refreshNow(getContext());
        call.resolve();
    }
}
