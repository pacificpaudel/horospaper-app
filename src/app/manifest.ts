import type { MetadataRoute } from "next";

// The web app manifest (served at /manifest.webmanifest and linked by
// Next.js): what makes horospaper installable from the browser, as a
// home-screen web app. (The Play Store app is the Capacitor app -- see
// capacitor.config.ts.) Icons come from scripts/writeAppIcons.ts.

const BACKGROUND = "#101322"; // --background in globals.css

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/home",
    name: "horospaper — Your day, written in the stars",
    short_name: "horospaper",
    description: "A daily Vedic reading shaped by your birth details and the sky above, as a wallpaper.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    // Portrait on a phone, landscape on a frame or tablet.
    orientation: "any",
    background_color: BACKGROUND,
    theme_color: BACKGROUND,
    categories: ["lifestyle", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
