import { getStoredGuestId } from "./guest";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Fetch wrapper for authenticated/guest API calls. Attaches the stored
 * guest id header when present -- the server ignores it for real,
 * signed-in sessions and only falls back to it for guests, so it's safe
 * to always include.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const guestId = getStoredGuestId();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (guestId) headers.set("x-guest-id", guestId);

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data?.error || "Something went wrong", res.status);
  }
  return data as T;
}
