package com.horospaper.app.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/**
 * What the three widgets share: placed, resized or due an update, they
 * ask WidgetUpdater to redraw (in the background), and keep a two-hourly
 * refresh going while any of them is on the home screen.
 */
public abstract class HoroscopeWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        WidgetUpdater.schedulePeriodic(context);
        WidgetUpdater.refreshNow(context);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int widgetId, Bundle options) {
        // Resized: draw a picture of the new size.
        WidgetUpdater.refreshNow(context);
    }

    @Override
    public void onDisabled(Context context) {
        WidgetUpdater.cancelPeriodicIfUnused(context);
    }
}
