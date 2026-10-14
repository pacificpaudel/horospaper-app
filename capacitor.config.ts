import type { CapacitorConfig } from "@capacitor/cli";

// The Android app (Capacitor): a native shell that opens the live site, so
// every web deploy reaches the app at once, plus what only a native app
// can do -- daily push notifications and home-screen widgets (see
// android/app/src/main/java/com/horospaper/app/widgets).
//
// appId is the app's permanent identity on Google Play: it can't change
// after the first upload, and Firebase and ANDROID_PACKAGE_NAME must match it.
// HOROSPAPER_URL overrides the site the app opens (e.g. a preview deploy).

const config: CapacitorConfig = {
  appId: "com.horospaper.app",
  appName: "horospaper",
  // Only shown if the live site can't be reached at all (see capacitor-web/index.html).
  webDir: "capacitor-web",
  server: {
    url: process.env.HOROSPAPER_URL || "https://horospaper-app.vercel.app",
    androidScheme: "https",
    errorPath: "index.html",
  },
  android: {
    backgroundColor: "#101322",
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
