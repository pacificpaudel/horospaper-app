import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/", destination: "/home", permanent: false }];
  },
  async rewrites() {
    // Android's app-to-site check reads this exact path (see api/assetlinks).
    return [{ source: "/.well-known/assetlinks.json", destination: "/api/assetlinks" }];
  },
  async headers() {
    return [
      {
        // The service worker is always re-fetched, so an update reaches every installed app.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
