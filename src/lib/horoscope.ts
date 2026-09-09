import { randomUUID } from "node:crypto";
import { BirthProfile } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { buildStructuredAstrologyData, StructuredAstrologyData } from "@/lib/astrology";
import { dateOnlyUtc } from "@/lib/astrology/dailyData";
import { generateHoroscope } from "@/lib/llm/generateHoroscope";
import { HoroscopeSections } from "@/lib/llm/types";
import { generateHoroscopeImage } from "@/lib/image/generateImage";
import { buildDailyAstrologyKey, calculateLuckScore } from "@/lib/luckScore";

export class HoroscopeGenerationError extends Error {
  constructor(public stage: "astrology" | "llm" | "image" | "unknown", message: string) {
    super(message);
  }
}

function birthDateTimeToUtc(profile: BirthProfile): Date {
  const dateStr = profile.birthDate.toISOString().slice(0, 10); // YYYY-MM-DD
  const localIso = `${dateStr}T${profile.birthTime}:00`;
  return fromZonedTime(localIso, profile.timezone);
}

export async function getExistingHoroscope(userId: string, date: Date, isPreview = false) {
  const day = dateOnlyUtc(date);
  return prisma.horoscope.findUnique({
    where: { userId_generationDate_isPreview: { userId, generationDate: day, isPreview } },
  });
}

/**
 * Runs the full pipeline: astrology calculation -> structured data ->
 * horoscope text -> image prompt -> image -> persisted result.
 * Idempotent per (user, date, isPreview) thanks to the DB unique
 * constraint -- callers should check getExistingHoroscope first.
 */
export async function generateHoroscopeForUser(params: {
  userId: string;
  profile: BirthProfile;
  forDate?: Date;
  isPreview?: boolean;
}) {
  const { userId, profile, forDate = new Date(), isPreview = false } = params;
  const day = dateOnlyUtc(forDate);

  let astrology: StructuredAstrologyData;
  try {
    astrology = await buildStructuredAstrologyData({
      birthDateTimeUtc: birthDateTimeToUtc(profile),
      latitude: profile.latitude,
      longitude: profile.longitude,
      system: profile.astrologySystem,
      forDate: day,
    });
  } catch (err) {
    await logGenerationError(userId, "astrology", err);
    throw new HoroscopeGenerationError("astrology", "We couldn't calculate today's chart. Please try again.");
  }

  let sections: HoroscopeSections;
  try {
    const result = await generateHoroscope(astrology, { name: profile.name, language: profile.language });
    sections = result.sections;
  } catch (err) {
    await logGenerationError(userId, "llm", err);
    throw new HoroscopeGenerationError("llm", "We couldn't write today's horoscope. Please try again.");
  }

  const horoscopeId = randomUUID();
  let imageUrl: string | undefined;
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
    imagePrompt = image.prompt;
  } catch (err) {
    await logGenerationError(userId, "image", err);
    // Text is still valuable without an image -- don't fail the whole request.
  }

  return prisma.horoscope.upsert({
    where: { userId_generationDate_isPreview: { userId, generationDate: day, isPreview } },
    create: {
      id: horoscopeId,
      userId,
      generationDate: day,
      astrologyData: astrology as never,
      horoscopeText: sections as never,
      imageUrl,
      imagePrompt,
      imageStyle: profile.imageStyle,
      isPreview,
    },
    update: {
      astrologyData: astrology as never,
      horoscopeText: sections as never,
      imageUrl,
      imagePrompt,
      imageStyle: profile.imageStyle,
    },
  });
}

async function logGenerationError(userId: string, stage: "astrology" | "llm" | "image", err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[horoscope:${stage}]`, message);
  await prisma.generationError.create({ data: { userId, stage, message } }).catch(() => undefined);
}
