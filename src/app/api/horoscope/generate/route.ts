import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getBirthProfile } from "@/lib/profile";
import { generateHoroscopeForUser, getExistingHoroscope, HoroscopeGenerationError } from "@/lib/horoscope";
import { canConsumeGeneration, consumeGeneration, getFreeLimit, getUsageCount } from "@/lib/usage";
import { todayForTimezone } from "@/lib/timezoneDay";
import { isValidTimeZone } from "@/lib/validation";

/**
 * Generates today's horoscope (or tomorrow's preview when { preview: true }
 * is sent). Idempotent for a given day: if a horoscope already exists for
 * that (user, date, preview) combination, it's returned as-is instead of
 * calling the LLM/image APIs again -- the one exception is that a preview
 * or a re-generation of an existing day consumes the daily "extra
 * generations" budget.
 */
export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const preview = Boolean(body?.preview);
  const refresh = Boolean(body?.refresh);
  const desktopRatio = typeof body?.desktopRatio === "number" && Number.isFinite(body.desktopRatio) ? body.desktopRatio : undefined;

  // The zone the user is in *now* (sent by their browser), which is what
  // decides when "today" rolls over. The profile's timezone is the birth
  // timezone -- right for the natal chart, wrong for someone born in Nepal
  // who now lives in Finland, whose wallpaper would otherwise flip at
  // Nepal's midnight (21:15 in Helsinki) instead of their own.
  const currentTimezone = typeof body?.timezone === "string" && isValidTimeZone(body.timezone) ? body.timezone : undefined;

  const profile = await getBirthProfile(user.id);
  if (!profile) {
    return NextResponse.json({ error: "Please complete your birth profile first" }, { status: 400 });
  }

  // Anchored to the user's own current timezone so "today" means their
  // local calendar day, not the server's UTC day -- otherwise anyone well
  // ahead of UTC would keep getting yesterday's horoscope/wallpaper for
  // hours after their own day has already started.
  const targetDate = todayForTimezone(new Date(), currentTimezone ?? profile.timezone);
  if (preview) targetDate.setUTCDate(targetDate.getUTCDate() + 1);

  const existing = await getExistingHoroscope(user.id, targetDate, preview);
  // Stored before the luck/tags rework: rebuild it for free rather than
  // serving a wallpaper with the old always-"joyful" reading.
  const legacy = Boolean(existing && !existing.dailyReading);
  if (existing && !refresh && !legacy) {
    return NextResponse.json({ horoscope: existing, cached: true });
  }

  // Scoped to targetDate (the user's own local day), matching the horoscope
  // cache lookup above -- not the server's raw UTC "now". Otherwise a
  // non-UTC user's automatic midnight refresh could see a stale usage count
  // left over from the previous UTC day and get wrongly rejected here,
  // silently blocking the new day's wallpaper from ever being generated.
  const isFirstGenerationToday = !preview && (legacy || (await getUsageCount(user.id, targetDate)) === 0);
  if (!isFirstGenerationToday) {
    const allowed = await canConsumeGeneration(user.id, targetDate);
    if (!allowed) {
      return NextResponse.json(
        { error: `You've reached today's limit of ${getFreeLimit()} extra generation(s). Come back tomorrow!` },
        { status: 429 }
      );
    }
    await consumeGeneration(user.id, targetDate);
  }

  try {
    const horoscope = await generateHoroscopeForUser({
      userId: user.id,
      profile,
      forDate: targetDate,
      isPreview: preview,
      desktopRatio,
      regenerateArt: refresh,
    });
    return NextResponse.json({ horoscope, cached: false });
  } catch (err) {
    if (err instanceof HoroscopeGenerationError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("[api/horoscope/generate] unexpected error", err);
    return NextResponse.json({ error: "Something went wrong generating your horoscope." }, { status: 500 });
  }
}
