"use client";

import { useEffect } from "react";
import { ensureGuestId } from "@/lib/client/guest";

// What the site does when it's running inside the Android app (Capacitor)
// rather than a browser: shares the guest id with the native home-screen
// widgets, registers for the daily morning push, and opens the app where a
// tapped notification points. Does nothing in a browser.

/** SharedPreferences keys (Capacitor Preferences) the widgets read; see WidgetUpdater.java. */
const PREF = { guestId: "horospaper.guestId", timezone: "horospaper.timezone", serverUrl: "horospaper.serverUrl" } as const;

export function NativeApp() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      const { Capacitor, registerPlugin } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;
      const [{ Preferences }, { PushNotifications }] = await Promise.all([import("@capacitor/preferences"), import("@capacitor/push-notifications")]);
      // A tiny native plugin (WidgetsPlugin.java): redraw the home-screen widgets now.
      const Widgets = registerPlugin<{ refresh(): Promise<void> }>("Widgets");

      const guestId = ensureGuestId();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await Promise.all([
        Preferences.set({ key: PREF.guestId, value: guestId }),
        Preferences.set({ key: PREF.timezone, value: timezone }),
        Preferences.set({ key: PREF.serverUrl, value: window.location.origin }),
      ]);
      Widgets.refresh().catch(() => {});

      const handles = await Promise.all([
        PushNotifications.addListener("registration", ({ value: token }) => {
          fetch("/api/device", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-guest-id": guestId },
            body: JSON.stringify({ token, timezone }),
          }).catch(() => {});
        }),
        PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
          const path = typeof notification.data?.path === "string" ? notification.data.path : "/home";
          if (path.startsWith("/") && window.location.pathname !== path) window.location.assign(path);
        }),
      ]);
      // Leaving the app (after seeing today's chart): bring the widgets up to date.
      const onHide = () => document.visibilityState === "hidden" && Widgets.refresh().catch(() => {});
      document.addEventListener("visibilitychange", onHide);
      cleanup = () => {
        handles.forEach((handle) => handle.remove());
        document.removeEventListener("visibilitychange", onHide);
      };

      await PushNotifications.createChannel({ id: "daily", name: "Daily Luck Chart", description: "Your Luck Chart and wallpaper each morning", importance: 4 });
      let permission = await PushNotifications.checkPermissions();
      if (permission.receive === "prompt") permission = await PushNotifications.requestPermissions();
      if (permission.receive === "granted") await PushNotifications.register();
    })().catch((err) => console.error("[native] setup failed:", err));
    return () => cleanup?.();
  }, []);
  return null;
}
