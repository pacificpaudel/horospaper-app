import { redis } from "@/lib/redis";
import type { PhysicalSymptomId, PhysicalSymptomRatings } from "@/lib/physicalSymptoms";

export interface DailyPhysicalSymptomLog {
  date: string;
  symptoms: PhysicalSymptomId[];
  ratings: PhysicalSymptomRatings;
  updatedAt: string;
}

const logKey = (userId: string, date: string) => `physical-symptoms:${userId}:${date}`;
const datesKey = (userId: string) => `physical-symptom-dates:${userId}`;

export async function getDailyPhysicalSymptoms(userId: string, date: string): Promise<DailyPhysicalSymptomLog | null> {
  return (await redis.get<DailyPhysicalSymptomLog>(logKey(userId, date))) ?? null;
}

export async function saveDailyPhysicalSymptoms(
  userId: string,
  date: string,
  symptoms: PhysicalSymptomId[],
  ratings: PhysicalSymptomRatings,
): Promise<DailyPhysicalSymptomLog> {
  const log: DailyPhysicalSymptomLog = { date, symptoms, ratings, updatedAt: new Date().toISOString() };
  await Promise.all([redis.set(logKey(userId, date), log), redis.sadd(datesKey(userId), date)]);
  return log;
}

export async function listPhysicalSymptomDates(userId: string): Promise<string[]> {
  return (await redis.smembers(datesKey(userId))) ?? [];
}

export async function deletePhysicalSymptomsForUser(userId: string): Promise<void> {
  const dates = await listPhysicalSymptomDates(userId);
  await redis.del(datesKey(userId), ...dates.map((date) => logKey(userId, date)));
}
