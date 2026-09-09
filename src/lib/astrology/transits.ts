import { ASPECTS, PLANET_LABELS, PlanetKey } from "./constants";
import { PlanetPosition } from "./ephemeris";
import { angularDistance } from "./zodiac";
import { NatalChart } from "./natalChart";

export interface TransitAspect {
  transitingPlanet: PlanetKey;
  natalPlanet: PlanetKey;
  aspect: string;
  nature: "harmonious" | "challenging" | "neutral";
  orb: number; // actual deviation from exact, in degrees
  description: string;
}

/**
 * Finds meaningful aspects between today's transiting planets and the
 * natal chart's planets, within each aspect's allowed orb.
 */
export function computeTransits(
  todaysPlanets: Record<PlanetKey, PlanetPosition>,
  natalChart: NatalChart
): TransitAspect[] {
  const results: TransitAspect[] = [];

  for (const [transitKey, transitPos] of Object.entries(todaysPlanets) as [
    PlanetKey,
    PlanetPosition
  ][]) {
    for (const [natalKey, natalPos] of Object.entries(natalChart.planets) as [
      PlanetKey,
      PlanetPosition
    ][]) {
      const distance = angularDistance(transitPos.longitude, natalPos.longitude);

      for (const aspectDef of ASPECTS) {
        const deviation = Math.abs(distance - aspectDef.angle);
        if (deviation <= aspectDef.orb) {
          results.push({
            transitingPlanet: transitKey,
            natalPlanet: natalKey,
            aspect: aspectDef.name,
            nature: aspectDef.nature,
            orb: Math.round(deviation * 100) / 100,
            description: `Transiting ${PLANET_LABELS[transitKey]} ${aspectDef.name.toLowerCase()} natal ${PLANET_LABELS[natalKey]}`,
          });
          break; // only the closest matching aspect per pair
        }
      }
    }
  }

  // Prioritize tighter, more significant aspects and cap the list so the
  // LLM prompt stays focused on what actually matters today.
  return results.sort((a, b) => a.orb - b.orb).slice(0, 8);
}
