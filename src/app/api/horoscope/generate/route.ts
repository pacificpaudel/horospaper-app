import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getBirthProfile } from "@/lib/profile";
import { generateHoroscopeForUser, getExistingHoroscope, HoroscopeGenerationError } from "@/lib/horoscope";
import { canConsumeGeneration, consumeGeneration, getFreeLimit, getUsageCount } from "@/lib/usage";

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

  const profile = await getBirthProfile(user.id);
  if (!profile) {
    return NextResponse.json({ error: "Please complete your birth profile first" }, { status: 400 });
  }

  const targetDate = new Date();
  if (preview) targetDate.setUTCDate(targetDate.getUTCDate() + 1);

  const existing = await getExistingHoroscope(user.id, targetDate, preview);
  const hasCurrentDailyImage = existing?.imageUrl?.includes("-daily-image-v9.");
  if (existing && (!refresh || hasCurrentDailyImage)) {
    return NextResponse.json({ horoscope: existing, cached: true });
  }

  const isFirstGenerationToday = !preview && (await getUsageCount(user.id)) === 0;
  if (!isFirstGenerationToday) {
    const allowed = await canConsumeGeneration(user.id);
    if (!allowed) {
      return NextResponse.json(
        { error: `You've reached today's limit of ${getFreeLimit()} extra generation(s). Come back tomorrow!` },
        { status: 429 }
      );
    }
    await consumeGeneration(user.id);
  }

  try {
    const horoscope = await generateHoroscopeForUser({ userId: user.id, profile, forDate: targetDate, isPreview: preview, desktopRatio });
    return NextResponse.json({ horoscope, cached: false });
  } catch (err) {
    if (err instanceof HoroscopeGenerationError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("[api/horoscope/generate] unexpected error", err);
    return NextResponse.json({ error: "Something went wrong generating your horoscope." }, { status: 500 });
  }
}
