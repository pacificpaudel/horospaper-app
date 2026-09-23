import { getPlanetPosition } from "./ephemeris";
import { tropicalToSidereal } from "./zodiac";
import { formatSignPosition, NAKSHATRAS, nakshatraIndex, Rashi, rashiForMoon } from "./rashi";

// Client-safe: only depends on astronomy-engine, no server modules. The
// birth-profile form lazy-loads this to show the read-only birth-chart
// panel as soon as a date of birth is entered.

export interface BirthSnapshot {
  rashi: Rashi;
  moon: string;
  moonNakshatra: string;
  saturn: string;
  mars: string;
}

/** Sidereal (Lahiri) Moon / Saturn / Mars placements at a UTC birth instant. */
export function computeBirthSnapshot(birthDateTimeUtc: Date): BirthSnapshot {
  const sidereal = (planet: "moon" | "saturn" | "mars") =>
    tropicalToSidereal(getPlanetPosition(planet, birthDateTimeUtc).longitude, birthDateTimeUtc);
  const moon = sidereal("moon");
  return {
    rashi: rashiForMoon(moon),
    moon: formatSignPosition(moon),
    moonNakshatra: NAKSHATRAS[nakshatraIndex(moon)],
    saturn: formatSignPosition(sidereal("saturn")),
    mars: formatSignPosition(sidereal("mars")),
  };
}
