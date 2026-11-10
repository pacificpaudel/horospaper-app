import { redis } from "@/lib/redis";
import type { DailyReading } from "@/lib/dailyReading";

export interface ArchivedCalendarDay {
  date: string;
  reading: DailyReading;
  moonPhaseName: string;
  moonIllumination: number;
  updatedAt: string;
}

export interface CalendarNote {
  date: string;
  text: string;
  updatedAt: string;
}

const archiveKey = (userId: string, date: string) => `calendar-day:${userId}:${date}`;
const archiveDatesKey = (userId: string) => `calendar-days:${userId}`;
const noteKey = (userId: string, date: string) => `calendar-note:${userId}:${date}`;
const noteDatesKey = (userId: string) => `calendar-note-dates:${userId}`;

export async function saveArchivedCalendarDay(userId: string, record: Omit<ArchivedCalendarDay, "updatedAt">): Promise<void> {
  const archived: ArchivedCalendarDay = { ...record, updatedAt: new Date().toISOString() };
  await Promise.all([redis.set(archiveKey(userId, record.date), archived), redis.sadd(archiveDatesKey(userId), record.date)]);
}

export async function getArchivedCalendarDay(userId: string, date: string): Promise<ArchivedCalendarDay | null> {
  return (await redis.get<ArchivedCalendarDay>(archiveKey(userId, date))) ?? null;
}

export async function getArchivedCalendarDays(userId: string, dates: readonly string[]): Promise<Map<string, ArchivedCalendarDay>> {
  const known = new Set(await redis.smembers(archiveDatesKey(userId)));
  const available = dates.filter((date) => known.has(date));
  const records = await Promise.all(available.map((date) => redis.get<ArchivedCalendarDay>(archiveKey(userId, date))));
  return new Map(available.flatMap((date, index) => records[index] ? [[date, records[index]!]] : []));
}

export async function getCalendarNotes(userId: string, dates: readonly string[]): Promise<Map<string, CalendarNote>> {
  const known = new Set(await redis.smembers(noteDatesKey(userId)));
  const available = dates.filter((date) => known.has(date));
  const records = await Promise.all(available.map((date) => redis.get<CalendarNote>(noteKey(userId, date))));
  return new Map(available.flatMap((date, index) => records[index] ? [[date, records[index]!]] : []));
}

export async function saveCalendarNote(userId: string, date: string, text: string): Promise<CalendarNote | null> {
  const key = noteKey(userId, date);
  if (!text.trim()) {
    await Promise.all([redis.del(key), redis.srem(noteDatesKey(userId), date)]);
    return null;
  }
  const note: CalendarNote = { date, text: text.trim().slice(0, 2000), updatedAt: new Date().toISOString() };
  await Promise.all([redis.set(key, note), redis.sadd(noteDatesKey(userId), date)]);
  return note;
}

export async function migrateCalendarData(fromUserId: string, toUserId: string): Promise<void> {
  const archiveDates = await redis.smembers(archiveDatesKey(fromUserId));
  const noteDates = await redis.smembers(noteDatesKey(fromUserId));
  for (const date of archiveDates) {
    const [source, target] = await Promise.all([
      redis.get<ArchivedCalendarDay>(archiveKey(fromUserId, date)),
      redis.get<ArchivedCalendarDay>(archiveKey(toUserId, date)),
    ]);
    if (source && !target) await Promise.all([redis.set(archiveKey(toUserId, date), source), redis.sadd(archiveDatesKey(toUserId), date)]);
  }
  for (const date of noteDates) {
    const [source, target] = await Promise.all([
      redis.get<CalendarNote>(noteKey(fromUserId, date)),
      redis.get<CalendarNote>(noteKey(toUserId, date)),
    ]);
    if (source && !target) await Promise.all([redis.set(noteKey(toUserId, date), source), redis.sadd(noteDatesKey(toUserId), date)]);
  }
}

export async function deleteCalendarDataForUser(userId: string): Promise<void> {
  const [archiveDates, noteDates] = await Promise.all([
    redis.smembers(archiveDatesKey(userId)),
    redis.smembers(noteDatesKey(userId)),
  ]);
  await redis.del(
    archiveDatesKey(userId), noteDatesKey(userId),
    ...archiveDates.map((date) => archiveKey(userId, date)),
    ...noteDates.map((date) => noteKey(userId, date)),
  );
}
