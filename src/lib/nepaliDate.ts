import NepaliDateModule from "nepali-date-converter";

// The package ships a UMD build as `main`; depending on how the bundler
// resolves it the default export can arrive wrapped one level deeper.
const NepaliDate = ((NepaliDateModule as unknown as { default?: typeof NepaliDateModule }).default ?? NepaliDateModule) as typeof NepaliDateModule;

// The converter's lookup table covers BS 2000-2090 (~1943-2034 AD).
export const BS_MIN_YEAR = 2000;
export const BS_MAX_YEAR = 2090;

export const BS_MONTHS = [
  "Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatBs(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Days in BS month `month` (1-12) of `year` -- BS months run 29 to 32 days, varying by year. */
export function bsMonthLength(year: number, month: number): number {
  for (let day = 32; day >= 29; day--) {
    if (bsToAd(formatBs(year, month, day))) return day;
  }
  return 30;
}

/** Weekday (0 = Sunday) the given BS date falls on, or null if it isn't a valid BS date. */
export function bsWeekday(year: number, month: number, day: number): number | null {
  const ad = bsToAd(formatBs(year, month, day));
  if (!ad) return null;
  const [y, m, d] = ad.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Today's date in BS, per the device's own calendar day. */
export function bsToday(): string | null {
  const now = new Date();
  return adToBs(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
}

/** "YYYY-MM-DD" AD -> "YYYY-MM-DD" BS, or null if out of range / invalid. */
export function adToBs(ad: string): string | null {
  const m = DATE_RE.exec(ad);
  if (!m) return null;
  try {
    // Noon local time keeps the calendar day stable regardless of the
    // runtime's own timezone.
    const bs = new NepaliDate(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)).getBS();
    return `${bs.year}-${pad(bs.month + 1)}-${pad(bs.date)}`;
  } catch {
    return null;
  }
}

/** "YYYY-MM-DD" BS -> "YYYY-MM-DD" AD, or null if out of range / not a real BS date. */
export function bsToAd(bs: string): string | null {
  const m = DATE_RE.exec(bs);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (year < BS_MIN_YEAR || year > BS_MAX_YEAR || month < 1 || month > 12 || day < 1 || day > 32) return null;
  try {
    const date = new NepaliDate(year, month - 1, day);
    // The converter silently rolls overflowing days into the next month
    // (e.g. day 32 of a 31-day month) -- reject those instead.
    const back = date.getBS();
    if (back.year !== year || back.month !== month - 1 || back.date !== day) return null;
    const ad = date.getAD();
    return `${ad.year}-${pad(ad.month + 1)}-${pad(ad.date)}`;
  } catch {
    return null;
  }
}
