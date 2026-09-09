import { angularDistance } from "@/lib/astrology/zodiac";

export interface LuckAstrologyData {
  generationDate: string;
  system: string;
  natalChart: {
    latitude: number;
    longitude: number;
    planets: Record<string, { planet: string; longitude: number }>;
    ascendant: { longitude: number } | null;
  };
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
  transits: { nature: "harmonious" | "challenging" | "neutral"; orb: number }[];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Produces a stable daily score from the Vedic chart and today's ephemeris.
 * The input is date-scoped astrology data, so refreshing the same profile on
 * the same UTC astrology day cannot change the result.
 */
export function calculateLuckScore(astrology: LuckAstrologyData): number {
  const natal = astrology.natalChart.planets;
  const current = astrology.today;
  const sunDistance = angularDistance(
    natal.sun.longitude,
    current.sunLongitude,
  );
  const moonDistance = angularDistance(
    natal.moon.longitude,
    current.moonLongitude,
  );
  const ascendantAlignment = astrology.natalChart.ascendant
    ? Math.round((1 - angularDistance(astrology.natalChart.ascendant.longitude, current.sunLongitude) / 180) * 5)
    : 0;
  const transitScore = astrology.transits.reduce((score, transit) => {
    const weight = Math.max(1, Math.round(8 - transit.orb));
    if (transit.nature === "harmonious") return score + weight;
    if (transit.nature === "challenging") return score - weight;
    return score + 1;
  }, 0);
  const luminaryAlignment = Math.round((1 - sunDistance / 180) * 8) + Math.round((1 - moonDistance / 180) * 10);
  const moonPhaseScore = Math.round(current.moonIllumination * 12);
  const retrogradePenalty = Math.min(current.retrogradePlanets.length * 3, 15);
  const ascendantBonus = astrology.ascendantSign ? 3 : 0;

  return clamp(50 + luminaryAlignment + ascendantAlignment + moonPhaseScore + transitScore + ascendantBonus - retrogradePenalty, 12, 98);
}

/** Stable key for artwork and UI refreshes within one astrology date. */
export function buildDailyAstrologyKey(astrology: LuckAstrologyData): string {
  const natalKey = Object.values(astrology.natalChart.planets)
    .map((planet) => `${planet.planet}:${planet.longitude.toFixed(3)}`)
    .join("|");
  const placeKey = `${astrology.natalChart.latitude.toFixed(3)},${astrology.natalChart.longitude.toFixed(3)}`;
  const ascendantKey = astrology.natalChart.ascendant?.longitude.toFixed(3) ?? "none";
  return `${astrology.system}:${astrology.generationDate}:${placeKey}:${ascendantKey}:${natalKey}:${astrology.today.sunSign}:${astrology.today.moonSign}`;
}
