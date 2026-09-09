import { redis, TTL_SECONDS } from "@/lib/redis";
import { dateOnlyString } from "@/lib/astrology/dailyData";

function freeLimit(): number {
  const n = parseInt(process.env.FREE_GENERATIONS_PER_DAY || "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function usageLimitsDisabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.DISABLE_USAGE_LIMITS === "true";
}

function usageKey(userId: string, date: Date): string {
  return `usage:${userId}:${dateOnlyString(date)}`;
}

/**
 * Tracks "extra" generation actions per user per day (regenerating an
 * already-generated day, or generating tomorrow's preview). The very
 * first, automatic generation for "today" is always free and does not
 * consume this budget -- it's the core product experience and is cached
 * by the per-(user, day) horoscope key anyway.
 */
export async function getUsageCount(userId: string, date: Date = new Date()): Promise<number> {
  return (await redis.get<number>(usageKey(userId, date))) ?? 0;
}

export async function canConsumeGeneration(userId: string, date: Date = new Date()): Promise<boolean> {
  if (usageLimitsDisabled()) return true;
  return (await getUsageCount(userId, date)) < freeLimit();
}

export async function consumeGeneration(userId: string, date: Date = new Date()): Promise<number> {
  if (usageLimitsDisabled()) return getUsageCount(userId, date);
  const key = usageKey(userId, date);
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, TTL_SECONDS);
  return count;
}

export async function deleteUsageForUser(userId: string): Promise<void> {
  const today = new Date();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await redis.del(usageKey(userId, today), usageKey(userId, tomorrow));
}

export function getFreeLimit(): number {
  return freeLimit();
}
