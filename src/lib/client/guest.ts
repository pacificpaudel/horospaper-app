const GUEST_ID_KEY = "cosmic_guest_id";

export function getStoredGuestId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(GUEST_ID_KEY);
}

/** Returns the existing guest id, or creates one via the API and persists it. */
export async function ensureGuestId(): Promise<string> {
  const existing = getStoredGuestId();
  if (existing) return existing;

  const res = await fetch("/api/guest", { method: "POST" });
  const data = (await res.json()) as { userId: string };
  window.localStorage.setItem(GUEST_ID_KEY, data.userId);
  return data.userId;
}

export function clearGuestId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(GUEST_ID_KEY);
}
