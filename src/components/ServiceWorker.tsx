"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js (installability and the offline page) -- in
 * production only, so the dev server's hot reload is never served stale.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
