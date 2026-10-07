// The birth form's last-entered values, kept in this browser for a month so
// the fields come back filled in on a later visit -- even after the day
// rolls over or the server-side profile has expired.
const DRAFT_KEY = "horospaper_form_draft";
const DRAFT_TTL_MS = 31 * 24 * 60 * 60 * 1000;

export function loadFormDraft<T>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const { savedAt, values } = JSON.parse(raw) as { savedAt: number; values: T };
    if (!values || Date.now() - savedAt > DRAFT_TTL_MS) {
      window.localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return values;
  } catch {
    return null;
  }
}

export function saveFormDraft<T>(values: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), values }));
  } catch {
    // Private mode / storage full -- the form still works, just unremembered.
  }
}
