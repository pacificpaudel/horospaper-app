import { prisma } from "@/lib/prisma";
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

function computeDailyPlanetaryData(date: Date): DailyPlanetaryData {
  const planets = getAllPlanetPositions(date);
  const moonPhase = getMoonPhase(date);
  const retrogradePlanets = (Object.keys(planets) as PlanetKey[]).filter(
    (k) => planets[k].isRetrograde
  );
  return {
    date: dateOnlyUtc(date).toISOString().slice(0, 10),
    planets,
    moonPhase,
    retrogradePlanets,
  };
}

/**
 * Returns today's (or any given day's) planetary positions, using a
 * per-day cache so we compute the ephemeris only once per calendar day
 * regardless of how many users generate a horoscope.
 */
export async function getDailyPlanetaryData(forDate: Date = new Date()): Promise<DailyPlanetaryData> {
  const day = dateOnlyUtc(forDate);

  const cached = await prisma.planetaryDataCache.findUnique({ where: { date: day } });
  if (cached) {
    return cached.data as unknown as DailyPlanetaryData;
  }

  const data = computeDailyPlanetaryData(day);
  await prisma.planetaryDataCache.upsert({
    where: { date: day },
    create: { date: day, data: data as never },
    update: { data: data as never },
  });
  return data;
}
