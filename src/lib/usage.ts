import { prisma } from "@/lib/prisma";
import { dateOnlyUtc } from "@/lib/astrology/dailyData";

function freeLimit(): number {
  const n = parseInt(process.env.FREE_GENERATIONS_PER_DAY || "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function usageLimitsDisabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.DISABLE_USAGE_LIMITS === "true";
}

/**
 * Tracks "extra" generation actions per user per day (regenerating an
 * already-generated day, or generating tomorrow's preview). The very
 * first, automatic generation for "today" is always free and does not
 * consume this budget -- it's the core product experience and is cached
 * by the (userId, generationDate) unique constraint on Horoscope anyway.
 */
export async function getUsageCount(userId: string, date: Date = new Date()): Promise<number> {
  const day = dateOnlyUtc(date);
  const usage = await prisma.generationUsage.findUnique({
    where: { userId_generationDate: { userId, generationDate: day } },
  });
  return usage?.generationCount ?? 0;
}

export async function canConsumeGeneration(userId: string, date: Date = new Date()): Promise<boolean> {
  if (usageLimitsDisabled()) return true;
  return (await getUsageCount(userId, date)) < freeLimit();
}

export async function consumeGeneration(userId: string, date: Date = new Date()): Promise<number> {
  if (usageLimitsDisabled()) return getUsageCount(userId, date);
  const day = dateOnlyUtc(date);
  const usage = await prisma.generationUsage.upsert({
    where: { userId_generationDate: { userId, generationDate: day } },
    create: { userId, generationDate: day, generationCount: 1 },
    update: { generationCount: { increment: 1 } },
  });
  return usage.generationCount;
}

export function getFreeLimit(): number {
  return freeLimit();
}
