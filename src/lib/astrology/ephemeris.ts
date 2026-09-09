import * as Astronomy from "astronomy-engine";
import {
  MOON_PHASE_NAMES,
  NEVER_RETROGRADE,
  PLANET_BODIES,
  PlanetKey,
} from "./constants";
import { longitudeToSign, normalizeDegrees, SignPosition } from "./zodiac";

export interface PlanetPosition extends SignPosition {
  planet: PlanetKey;
  isRetrograde: boolean;
}

export interface MoonPhaseInfo {
  phaseAngle: number; // 0-360, 0 = new moon, 180 = full moon
  phaseName: (typeof MOON_PHASE_NAMES)[number];
  illumination: number; // 0-1
}

/**
 * Geocentric apparent tropical ecliptic longitude of a body at a given time,
 * referenced to the equinox of date (matches the classic tropical zodiac).
 * The Sun and Moon each need their own dedicated astronomy-engine call --
 * `EclipticLongitude` only supports the other planets.
 */
function eclipticLongitudeOf(planet: PlanetKey, date: Date): number {
  if (planet === "sun") {
    return normalizeDegrees(Astronomy.SunPosition(date).elon);
  }
  if (planet === "moon") {
    return normalizeDegrees(Astronomy.EclipticGeoMoon(date).lon);
  }
  const body = PLANET_BODIES[planet];
  return normalizeDegrees(Astronomy.EclipticLongitude(body, date));
}

function detectRetrograde(planet: PlanetKey, date: Date): boolean {
  if (NEVER_RETROGRADE.includes(planet)) return false;
  const stepHours = 12;
  const before = new Date(date.getTime() - stepHours * 3600 * 1000);
  const after = new Date(date.getTime() + stepHours * 3600 * 1000);
  const lonBefore = eclipticLongitudeOf(planet, before);
  const lonAfter = eclipticLongitudeOf(planet, after);
  // Handle 0/360 wraparound by comparing the shortest signed delta.
  let delta = lonAfter - lonBefore;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta < 0;
}

export function getPlanetPosition(planet: PlanetKey, date: Date): PlanetPosition {
  const longitude = eclipticLongitudeOf(planet, date);
  const signPosition = longitudeToSign(longitude);
  return {
    ...signPosition,
    planet,
    isRetrograde: detectRetrograde(planet, date),
  };
}

export function getAllPlanetPositions(date: Date): Record<PlanetKey, PlanetPosition> {
  const keys = Object.keys(PLANET_BODIES) as PlanetKey[];
  const result = {} as Record<PlanetKey, PlanetPosition>;
  for (const key of keys) {
    result[key] = getPlanetPosition(key, date);
  }
  return result;
}

export function getMoonPhase(date: Date): MoonPhaseInfo {
  const phaseAngle = normalizeDegrees(Astronomy.MoonPhase(date));
  const illumination = Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction;
  const index = Math.round(phaseAngle / 45) % 8;
  return {
    phaseAngle,
    phaseName: MOON_PHASE_NAMES[index],
    illumination,
  };
}

export function getRetrogradePlanets(date: Date): PlanetKey[] {
  const keys = Object.keys(PLANET_BODIES) as PlanetKey[];
  return keys.filter((k) => detectRetrograde(k, date));
}
