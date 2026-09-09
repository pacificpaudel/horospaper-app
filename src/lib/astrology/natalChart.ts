import { AstrologySystem } from "@/types/enums";
import { computeAscendantLongitude } from "./ascendant";
import { PlanetKey } from "./constants";
import { getAllPlanetPositions, PlanetPosition } from "./ephemeris";
import { longitudeToSign, SignPosition, tropicalToSidereal } from "./zodiac";

export interface NatalChart {
  birthDateTimeUtc: string;
  latitude: number;
  longitude: number;
  system: AstrologySystem;
  planets: Record<PlanetKey, PlanetPosition>;
  ascendant: SignPosition | null;
}

/**
 * Computes a natal chart from a UTC birth date/time and geographic location.
 * For the Vedic system, tropical longitudes are shifted by the Lahiri
 * ayanamsa to produce sidereal placements.
 */
export function computeNatalChart(
  birthDateTimeUtc: Date,
  latitude: number,
  longitude: number,
  system: AstrologySystem
): NatalChart {
  const tropicalPlanets = getAllPlanetPositions(birthDateTimeUtc);

  const planets =
    system === "VEDIC"
      ? (Object.fromEntries(
          Object.entries(tropicalPlanets).map(([key, pos]) => [
            key,
            {
              ...pos,
              ...longitudeToSign(tropicalToSidereal(pos.longitude, birthDateTimeUtc)),
            },
          ])
        ) as Record<PlanetKey, PlanetPosition>)
      : tropicalPlanets;

  let ascendant: SignPosition | null = null;
  const ascLongitude = computeAscendantLongitude(birthDateTimeUtc, latitude, longitude);
  ascendant =
    system === "VEDIC"
      ? longitudeToSign(tropicalToSidereal(ascLongitude, birthDateTimeUtc))
      : longitudeToSign(ascLongitude);

  return {
    birthDateTimeUtc: birthDateTimeUtc.toISOString(),
    latitude,
    longitude,
    system,
    planets,
    ascendant,
  };
}
