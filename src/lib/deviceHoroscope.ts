import { getBirthProfile } from "@/lib/profile";
import { generateHoroscopeForUser, getExistingHoroscope } from "@/lib/horoscope";
import { todayForTimezone } from "@/lib/timezoneDay";
import type { Horoscope } from "@/types/models";

/**
 * Today's horoscope (in `timezone`'s own calendar day) for a guest, made
 * now if there isn't one yet -- for the morning push and the home-screen
 * widgets, which need it before the app is opened. Null without a saved
 * birth profile. Like the app's first generation of a day, this is free.
 */
export async function ensureTodaysHoroscope(userId: string, timezone: string): Promise<Horoscope | null> {
  const profile = await getBirthProfile(userId);
  if (!profile) return null;
  const forDate = todayForTimezone(new Date(), timezone);
  const existing = await getExistingHoroscope(userId, forDate, false);
  if (existing?.dailyReading) return existing;
  return generateHoroscopeForUser({ userId, profile, forDate, isPreview: false, displayTimeZone: timezone });
}
