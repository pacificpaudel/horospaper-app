import { AstrologySystem } from "@/types/enums";
import { PLANET_LABELS, PlanetKey } from "./constants";
import { getDailyPlanetaryData } from "./dailyData";
import { computeNatalChart, NatalChart } from "./natalChart";
import { computeTransits, TransitAspect } from "./transits";

export * from "./constants";
export * from "./zodiac";
export * from "./ephemeris";
export * from "./ascendant";
export * from "./natalChart";
export * from "./transits";
export * from "./dailyData";

export interface StructuredAstrologyData {
  generationDate: string;
  system: AstrologySystem;
  natalChart: NatalChart;
  sunSign: string;
  moonSign: string;
  ascendantSign: string | null;
  today: {
    sunSign: string;
    moonSign: string;
    sunLongitude: number;
    moonLongitude: number;
    moonPhaseName: string;
    moonIllumination: number;
    retrogradePlanets: string[];
  };
  transits: TransitAspect[];
}

/**
 * Assembles the full structured astrology payload for a user: natal chart +
 * today's planetary positions + transits. This is the ONLY astrology
 * context the LLM ever receives -- it never computes positions itself.
 */
export async function buildStructuredAstrologyData(params: {
  birthDateTimeUtc: Date;
  latitude: number;
  longitude: number;
  system: AstrologySystem;
  forDate?: Date;
}): Promise<StructuredAstrologyData> {
  const { birthDateTimeUtc, latitude, longitude, system, forDate = new Date() } = params;

  const natalChart = computeNatalChart(birthDateTimeUtc, latitude, longitude, system);
  const daily = await getDailyPlanetaryData(forDate);
  const transits = computeTransits(daily.planets, natalChart);

  return {
    generationDate: daily.date,
    system,
    natalChart,
    sunSign: natalChart.planets.sun.sign,
    moonSign: natalChart.planets.moon.sign,
    ascendantSign: natalChart.ascendant?.sign ?? null,
    today: {
      sunSign: daily.planets.sun.sign,
      moonSign: daily.planets.moon.sign,
      sunLongitude: daily.planets.sun.longitude,
      moonLongitude: daily.planets.moon.longitude,
      moonPhaseName: daily.moonPhase.phaseName,
      moonIllumination: Math.round(daily.moonPhase.illumination * 100) / 100,
      retrogradePlanets: daily.retrogradePlanets.map((p: PlanetKey) => PLANET_LABELS[p]),
    },
    transits,
  };
}
