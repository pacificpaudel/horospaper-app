package com.horospaper.app.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.RemoteViews;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.horospaper.app.MainActivity;
import com.horospaper.app.R;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;

/**
 * Draws the three home-screen widgets (Luck Chart, Analysis, wallpaper):
 * each fetches a picture of exactly its own size from the site's
 * /api/widget/<kind> (see src/app/api/widget), as the guest the app is
 * signed in as. The web app shares that guest id, the phone's time zone
 * and the site's address through Capacitor Preferences (NativeApp.tsx),
 * which are stored in the "CapacitorStorage" SharedPreferences.
 */
public final class WidgetUpdater {
    private static final String TAG = "HoroscopeWidgets";
    private static final String PREFS = "CapacitorStorage";
    private static final String KEY_GUEST = "horospaper.guestId";
    private static final String KEY_TIMEZONE = "horospaper.timezone";
    private static final String KEY_SERVER = "horospaper.serverUrl";
    private static final String DEFAULT_SERVER = "https://horospaper-app.vercel.app";
    private static final String WORK_NOW = "horospaper-widgets-now";
    private static final String WORK_PERIODIC = "horospaper-widgets-periodic";
    // Widget pictures are kept within this many pixels on their long side, under Android's limit for widget bitmaps.
    private static final int MAX_SIDE = 1000;

    /** Every widget kind's provider. */
    static final Class<?>[] PROVIDERS = { LuckChartWidget.class, AnalysisWidget.class, WallpaperWidget.class };

    private WidgetUpdater() {}

    /** A provider's picture, as /api/widget/<kind> names it. */
    static String kindOf(Class<?> provider) {
        if (provider == LuckChartWidget.class) return "luck-chart";
        if (provider == AnalysisWidget.class) return "analysis";
        return "wallpaper";
    }

    /** Redraws every widget soon (on the network, in the background). */
    public static void refreshNow(Context context) {
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(WidgetRefreshWorker.class).setConstraints(networked()).build();
        WorkManager.getInstance(context).enqueueUniqueWork(WORK_NOW, ExistingWorkPolicy.REPLACE, request);
    }

    /** Keeps the widgets current through the day: a redraw every two hours (the day's chart changes at midnight). */
    static void schedulePeriodic(Context context) {
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(WidgetRefreshWorker.class, 2, TimeUnit.HOURS).setConstraints(networked()).build();
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(WORK_PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request);
    }

    /** Stops the two-hourly redraw once no widget is left on the home screen. */
    static void cancelPeriodicIfUnused(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (Class<?> provider : PROVIDERS) {
            if (manager.getAppWidgetIds(new ComponentName(context, provider)).length > 0) return;
        }
        WorkManager.getInstance(context).cancelUniqueWork(WORK_PERIODIC);
    }

    private static Constraints networked() {
        return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
    }

    /** Draws every placed widget now. Blocking: call from a background worker. */
    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (Class<?> provider : PROVIDERS) {
            for (int id : manager.getAppWidgetIds(new ComponentName(context, provider))) {
                updateOne(context, manager, id, kindOf(provider));
            }
        }
    }

    private static void updateOne(Context context, AppWidgetManager manager, int widgetId, String kind) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_image);
        views.setOnClickPendingIntent(R.id.widget_root, openApp(context));

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String guestId = prefs.getString(KEY_GUEST, null);
        String timezone = prefs.getString(KEY_TIMEZONE, TimeZone.getDefault().getID());
        String server = prefs.getString(KEY_SERVER, DEFAULT_SERVER);
        if (guestId == null) {
            showMessage(manager, widgetId, views, context.getString(R.string.widget_setup));
            return;
        }

        int[] size = pixelSize(context, manager, widgetId);
        try {
            String address = server + "/api/widget/" + kind + "?w=" + size[0] + "&h=" + size[1] + "&timezone=" + URLEncoder.encode(timezone, "UTF-8");
            HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
            connection.setRequestProperty("x-guest-id", guestId);
            connection.setConnectTimeout(20_000);
            // Today's chart may be made on the spot, which takes a while.
            connection.setReadTimeout(120_000);
            int status = connection.getResponseCode();
            if (status == 404) {
                // No birth details saved yet.
                showMessage(manager, widgetId, views, context.getString(R.string.widget_setup));
                return;
            }
            if (status != 200) throw new IllegalStateException("HTTP " + status);
            Bitmap bitmap;
            try (InputStream body = connection.getInputStream()) {
                bitmap = BitmapFactory.decodeStream(body);
            }
            if (bitmap == null) throw new IllegalStateException("Not an image");
            views.setImageViewBitmap(R.id.widget_image, bitmap);
            views.setViewVisibility(R.id.widget_image, View.VISIBLE);
            views.setViewVisibility(R.id.widget_message, View.GONE);
            manager.updateAppWidget(widgetId, views);
        } catch (Exception error) {
            // Keep showing the last picture; the next refresh tries again.
            Log.w(TAG, "Couldn't update the " + kind + " widget", error);
        }
    }

    private static void showMessage(AppWidgetManager manager, int widgetId, RemoteViews views, String message) {
        views.setTextViewText(R.id.widget_message, message);
        views.setViewVisibility(R.id.widget_message, View.VISIBLE);
        views.setViewVisibility(R.id.widget_image, View.GONE);
        manager.updateAppWidget(widgetId, views);
    }

    /** The widget's current size in pixels (its width, and its height in portrait), within MAX_SIDE. */
    private static int[] pixelSize(Context context, AppWidgetManager manager, int widgetId) {
        Bundle options = manager.getAppWidgetOptions(widgetId);
        float density = context.getResources().getDisplayMetrics().density;
        int widthDp = Math.max(options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250), 110);
        int heightDp = Math.max(options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 250), 110);
        float width = widthDp * density;
        float height = heightDp * density;
        float scale = Math.min(1f, MAX_SIDE / Math.max(width, height));
        return new int[] { Math.max(100, Math.round(width * scale)), Math.max(100, Math.round(height * scale)) };
    }

    private static PendingIntent openApp(Context context) {
        Intent intent = new Intent(context, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
