import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getBirthProfile } from "@/lib/profile";
import { getExistingHoroscope, needsSchumannRefresh, refreshHoroscopeWallpaper } from "@/lib/horoscope";
import { todayForTimezone } from "@/lib/timezoneDay";
import { isValidTimeZone } from "@/lib/validation";

/** Read today's saved wallpaper without starting a generation. */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const profile = await getBirthProfile(user.id);
  if (!profile) return NextResponse.json({ available: false }, { headers: { "Cache-Control": "private, no-store" } });

  const requestedTimezone = request.nextUrl.searchParams.get("timezone");
  const timezone = requestedTimezone && isValidTimeZone(requestedTimezone) ? requestedTimezone : profile.timezone;
  const today = todayForTimezone(new Date(), timezone);
  const saved = await getExistingHoroscope(user.id, today);
  const horoscope = saved && needsSchumannRefresh(saved)
    ? await refreshHoroscopeWallpaper(saved, timezone)
    : saved;
  return NextResponse.json(
    { available: Boolean(horoscope), horoscope },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
