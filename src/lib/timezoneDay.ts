import { toZonedTime } from "date-fns-tz";

/**
 * Anchors `date` to noon UTC on whatever calendar day it falls on *in
 * `timezone`*, instead of the caller's own (often UTC) calendar day.
 * Callers can then just use plain UTC calendar-date logic (dateOnlyString,
 * getUTCFullYear/Month/Date, etc.) on the result and get "today" in the
 * given timezone -- otherwise a user well ahead of UTC (e.g. Nepal,
 * UTC+5:45) crosses into their new local day up to ~18 hours before the
 * UTC date rolls over, and would keep seeing the previous day's horoscope/
 * wallpaper for that whole stretch. No server-only dependencies, so it's
 * safe to import from client components too.
 */
export function todayForTimezone(date: Date, timezone: string): Date {
  const zoned = toZonedTime(date, timezone);
  return new Date(Date.UTC(zoned.getFullYear(), zoned.getMonth(), zoned.getDate(), 12, 0, 0));
}
