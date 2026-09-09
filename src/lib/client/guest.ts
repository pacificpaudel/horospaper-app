const GUEST_ID_KEY = "cosmic_guest_id";

export function getStoredGuestId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(GUEST_ID_KEY);
}

/** Returns the existing guest id, or mints and persists a new one. */
export function ensureGuestId(): string {
  const existing = getStoredGuestId();
  if (existing) return existing;

  const id = window.crypto.randomUUID();
  window.localStorage.setItem(GUEST_ID_KEY, id);
  return id;
}

export function clearGuestId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(GUEST_ID_KEY);
}
