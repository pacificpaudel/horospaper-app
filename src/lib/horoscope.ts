import { randomUUID } from "node:crypto";
import { fromZonedTime } from "date-fns-tz";
import { redis, TTL_SECONDS } from "@/lib/redis";
import { buildStructuredAstrologyData, StructuredAstrologyData } from "@/lib/astrology";
import { dateOnlyString } from "@/lib/astrology/dailyData";
import { generateHoroscope } from "@/lib/llm/generateHoroscope";
import { HoroscopeSections } from "@/lib/llm/types";
import { generateHoroscopeImage } from "@/lib/image/generateImage";
import { buildDailyAstrologyKey, calculateLuckScore } from "@/lib/luckScore";
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
}): Promise<Horoscope> {
  const { userId, profile, forDate = new Date(), isPreview = false } = params;
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

  let sections: HoroscopeSections;
  try {
    const result = await generateHoroscope(astrology, { name: profile.name, language: profile.language });
    sections = result.sections;
  } catch (err) {
    logGenerationError(userId, "llm", err);
    throw new HoroscopeGenerationError("llm", "We couldn't write today's horoscope. Please try again.");
  }

  const horoscopeId = randomUUID();
  let imageUrl: string | undefined;
  let imageUrlMobile: string | undefined;
  let imagePrompt: string | undefined;
  try {
    const image = await generateHoroscopeImage({
      horoscopeId,
      stableSeed: buildDailyAstrologyKey(astrology),
      astrology,
      luckScore: calculateLuckScore(astrology),
      style: profile.imageStyle,
      luckyTheme: sections.luckyTheme,
      emotionalTheme: sections.overall,
    });
    imageUrl = image.url;
    imageUrlMobile = image.mobileUrl;
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
    horoscopeText: sections,
    imageUrl: imageUrl ?? null,
    imageUrlMobile: imageUrlMobile ?? null,
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
