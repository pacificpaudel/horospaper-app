import { randomUUID } from "node:crypto";
import { fromZonedTime } from "date-fns-tz";
import { redis, TTL_SECONDS } from "@/lib/redis";
import { buildStructuredAstrologyData, StructuredAstrologyData } from "@/lib/astrology";
import { dateOnlyString } from "@/lib/astrology/dailyData";
import { generateHoroscope } from "@/lib/llm/generateHoroscope";
import { HoroscopeSections } from "@/lib/llm/types";
import { generateHoroscopeImage } from "@/lib/image/generateImage";
import { buildDailyReading, DailyReading } from "@/lib/dailyReading";
import { fetchKundli } from "@/lib/astrologyApi";
import { kundliFromNatal } from "@/lib/image/kundliOverlay";
import { BirthProfile } from "@/types/models";
import { Horoscope } from "@/types/models";

export class HoroscopeGenerationError extends Error {
  constructor(public stage: "astrology" | "llm" | "image" | "unknown", message: string) {
    super(message);
  }
}

function birthDateTimeToUtc(profile: BirthProfile): Date {
  return fromZonedTime(`${profile.birthDate}T${profile.birthTime}:00`, profile.timezone);
}

/**
 * Stable key for artwork within one astrology date: same chart, same day,
 * same 2 tags -> same picked image across passive reloads.
 */
function buildDailyAstrologyKey(astrology: StructuredAstrologyData, reading: DailyReading): string {
  const natalKey = Object.values(astrology.natalChart.planets)
    .map((planet) => `${planet.planet}:${planet.longitude.toFixed(3)}`)
    .join("|");
  const placeKey = `${astrology.natalChart.latitude.toFixed(3)},${astrology.natalChart.longitude.toFixed(3)}`;
  const ascendantKey = astrology.natalChart.ascendant?.longitude.toFixed(3) ?? "none";
  return `${astrology.system}:${astrology.generationDate}:${placeKey}:${ascendantKey}:${natalKey}:${reading.intent.mood}:${reading.intent.theme}`;
}

function horoscopeKey(userId: string, day: string, isPreview: boolean): string {
  return `horoscope:${userId}:${day}:${isPreview ? "preview" : "today"}`;
}

export async function getExistingHoroscope(
  userId: string,
  date: Date,
  isPreview = false
): Promise<Horoscope | null> {
  const day = dateOnlyString(date);
  return (await redis.get<Horoscope>(horoscopeKey(userId, day, isPreview))) ?? null;
}

export async function deleteHoroscopesForUser(userId: string): Promise<void> {
  const today = dateOnlyString(new Date());
  const tomorrow = dateOnlyString(new Date(Date.now() + 24 * 60 * 60 * 1000));
  await redis.del(
    horoscopeKey(userId, today, false),
    horoscopeKey(userId, today, true),
    horoscopeKey(userId, tomorrow, false),
    horoscopeKey(userId, tomorrow, true)
  );
}

/**
 * Runs the full pipeline: astrology calculation -> structured data ->
 * horoscope text -> image prompt -> image -> stored result (24h TTL,
 * keyed by user + day + preview flag).
 */
export async function generateHoroscopeForUser(params: {
  userId: string;
  profile: BirthProfile;
  forDate?: Date;
  isPreview?: boolean;
  desktopRatio?: number;
  regenerateArt?: boolean;
}): Promise<Horoscope> {
  const { userId, profile, forDate = new Date(), isPreview = false, desktopRatio, regenerateArt = false } = params;
  const day = dateOnlyString(forDate);

  let astrology: StructuredAstrologyData;
  try {
    astrology = await buildStructuredAstrologyData({
      birthDateTimeUtc: birthDateTimeToUtc(profile),
      latitude: profile.latitude,
      longitude: profile.longitude,
      system: profile.astrologySystem,
      forDate,
    });
  } catch (err) {
    logGenerationError(userId, "astrology", err);
    throw new HoroscopeGenerationError("astrology", "We couldn't calculate today's chart. Please try again.");
  }

  // Independent of each other, so they run side by side: the horoscope
  // text, and the day's luck + 2 tags (planetary gochar + Nepali rashifal).
  const [textResult, reading] = await Promise.allSettled([
    generateHoroscope(astrology, { name: profile.name, language: profile.language }),
    buildDailyReading(astrology, forDate),
  ]);
  if (textResult.status === "rejected") {
    logGenerationError(userId, "llm", textResult.reason);
    throw new HoroscopeGenerationError("llm", "We couldn't write today's horoscope. Please try again.");
  }
  if (reading.status === "rejected") {
    logGenerationError(userId, "astrology", reading.reason);
    throw new HoroscopeGenerationError("astrology", "We couldn't read today's chart. Please try again.");
  }
  const sections: HoroscopeSections = textResult.value.sections;
  const dailyReading = reading.value;
  // The birth chart for the wallpaper: freeastrologyapi.com's when it's
  // reachable, else the app's own (identical) calculation.
  dailyReading.kundli =
    (await fetchKundli({
      birthDate: profile.birthDate,
      birthTime: profile.birthTime,
      timezone: profile.timezone,
      latitude: profile.latitude,
      longitude: profile.longitude,
    })) ?? kundliFromNatal(astrology.natalChart);

  const horoscopeId = randomUUID();
  let imageUrl: string | undefined;
  let imageUrlMobile: string | undefined;
  let imageUrlFrame: string | undefined;
  let imagePrompt: string | undefined;
  try {
    // The astrology-derived key alone keeps the artwork stable across
    // passive reloads within the same day (e.g. the midnight auto-refresh),
    // but an explicit user-requested regeneration should actually produce
    // different art -- mixing in this call's own horoscopeId gives it fresh
    // entropy without touching the deterministic astrology data/luck score.
    const baseSeed = buildDailyAstrologyKey(astrology, dailyReading);
    const imageSeed = regenerateArt ? `${baseSeed}:${horoscopeId}` : baseSeed;
    const image = await generateHoroscopeImage({
      horoscopeId,
      stableSeed: imageSeed,
      astrology,
      reading: dailyReading,
      style: profile.imageStyle,
      luckyTheme: sections.luckyTheme,
      emotionalTheme: sections.overall,
      desktopRatio,
      randomizeArt: regenerateArt,
    });
    imageUrl = image.url;
    imageUrlMobile = image.mobileUrl;
    imageUrlFrame = image.frameUrl;
    imagePrompt = image.prompt;
  } catch (err) {
    logGenerationError(userId, "image", err);
    // Text is still valuable without an image -- don't fail the whole request.
  }

  const horoscope: Horoscope = {
    id: horoscopeId,
    userId,
    generationDate: day,
    astrologyData: astrology,
    dailyReading,
    horoscopeText: sections,
    imageUrl: imageUrl ?? null,
    imageUrlMobile: imageUrlMobile ?? null,
    imageUrlFrame: imageUrlFrame ?? null,
    imagePrompt: imagePrompt ?? null,
    imageStyle: profile.imageStyle,
    isPreview,
    createdAt: new Date().toISOString(),
  };

  await redis.set(horoscopeKey(userId, day, isPreview), horoscope, { ex: TTL_SECONDS });
  return horoscope;
}

function logGenerationError(userId: string, stage: "astrology" | "llm" | "image", err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[horoscope:${stage}] user=${userId}`, message);
}
