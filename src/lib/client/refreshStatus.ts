"use client";

import { useSyncExternalStore } from "react";

// When the wallpaper on the home page last refreshed -- written by the home
// page, read by the footer (which lives in the root layout, outside the
// page's own state).
let lastRefreshed: Date | null = null;
const listeners = new Set<() => void>();

export function setLastRefreshed(date: Date | null) {
  lastRefreshed = date;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLastRefreshed(): Date | null {
  return useSyncExternalStore(subscribe, () => lastRefreshed, () => null);
}
