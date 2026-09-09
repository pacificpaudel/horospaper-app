import { redis, TTL_SECONDS } from "@/lib/redis";
import { PlanetKey } from "./constants";
import { getAllPlanetPositions, getMoonPhase, MoonPhaseInfo, PlanetPosition } from "./ephemeris";

export interface DailyPlanetaryData {
  date: string; // YYYY-MM-DD
  planets: Record<PlanetKey, PlanetPosition>;
  moonPhase: MoonPhaseInfo;
  retrogradePlanets: PlanetKey[];
}

export function dateOnlyUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function dateOnlyString(date: Date): string {
  return dateOnlyUtc(date).toISOString().slice(0, 10);
}

function computeDailyPlanetaryData(date: Date): DailyPlanetaryData {
  const planets = getAllPlanetPositions(date);
  const moonPhase = getMoonPhase(date);
  const retrogradePlanets = (Object.keys(planets) as PlanetKey[]).filter(
    (k) => planets[k].isRetrograde
  );
  return {
    date: dateOnlyString(date),
    planets,
    moonPhase,
    retrogradePlanets,
  };
}

/**
 * Returns today's (or any given day's) planetary positions, using a
 * per-day cache so we compute the ephemeris only once per calendar day
 * regardless of how many people generate a horoscope.
 */
export async function getDailyPlanetaryData(forDate: Date = new Date()): Promise<DailyPlanetaryData> {
  const day = dateOnlyUtc(forDate);
  const key = `planetary:${dateOnlyString(day)}`;

  const cached = await redis.get<DailyPlanetaryData>(key);
  if (cached) return cached;

  const data = computeDailyPlanetaryData(day);
  await redis.set(key, data, { ex: TTL_SECONDS });
  return data;
}
