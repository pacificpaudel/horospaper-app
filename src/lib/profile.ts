import { randomUUID } from "node:crypto";
import { redis, TTL_SECONDS } from "@/lib/redis";
import { deleteHoroscopesForUser } from "@/lib/horoscope";
import { deleteUsageForUser } from "@/lib/usage";
import { isRegisteredDevice, unregisterDevice } from "@/lib/devices";
import { BirthProfile } from "@/types/models";

export function profileKey(userId: string): string {
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
  // Kept for 24 hours -- or, for the Android app's registered devices, until
  // deleted, so each morning's chart can be made before the app is opened.
  if (await isRegisteredDevice(userId)) await redis.set(profileKey(userId), profile);
  else await redis.set(profileKey(userId), profile, { ex: TTL_SECONDS });
  return profile;
}

/** Removes everything stored for a guest: profile, today's/preview horoscopes, usage, and its app registration. */
export async function deleteUserData(userId: string): Promise<void> {
  await Promise.all([
    redis.del(profileKey(userId)),
    unregisterDevice(userId),
    deleteHoroscopesForUser(userId),
    deleteUsageForUser(userId),
  ]);
}
