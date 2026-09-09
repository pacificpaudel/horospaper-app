import { randomUUID } from "node:crypto";
import { redis, TTL_SECONDS } from "@/lib/redis";
import { deleteHoroscopesForUser } from "@/lib/horoscope";
import { deleteUsageForUser } from "@/lib/usage";
import { BirthProfile } from "@/types/models";

function profileKey(userId: string): string {
  return `profile:${userId}`;
}

export async function getBirthProfile(userId: string): Promise<BirthProfile | null> {
  return (await redis.get<BirthProfile>(profileKey(userId))) ?? null;
}

export async function saveBirthProfile(
  userId: string,
  data: Omit<BirthProfile, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<BirthProfile> {
  const existing = await getBirthProfile(userId);
  const now = new Date().toISOString();
  const profile: BirthProfile = {
    id: existing?.id ?? randomUUID(),
    userId,
    ...data,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await redis.set(profileKey(userId), profile, { ex: TTL_SECONDS });
  return profile;
}

/** Removes everything stored for a guest: profile, today's/preview horoscopes, and usage. */
export async function deleteUserData(userId: string): Promise<void> {
  await Promise.all([
    redis.del(profileKey(userId)),
    deleteHoroscopesForUser(userId),
    deleteUsageForUser(userId),
  ]);
}
