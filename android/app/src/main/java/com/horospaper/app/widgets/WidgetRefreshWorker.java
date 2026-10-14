package com.horospaper.app.widgets;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** Redraws the home-screen widgets in the background (see WidgetUpdater). */
public class WidgetRefreshWorker extends Worker {
    public WidgetRefreshWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        WidgetUpdater.updateAll(getApplicationContext());
        return Result.success();
    }
}
