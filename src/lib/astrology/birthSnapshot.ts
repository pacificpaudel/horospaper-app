import { getMoonPhase, getPlanetPosition } from "./ephemeris";
import { ZODIAC_SIGNS } from "./constants";
import { tropicalToSidereal } from "./zodiac";
import { formatSignPosition, NAKSHATRAS, nakshatraIndex, Rashi, rashiForMoon } from "./rashi";

// Client-safe: only depends on astronomy-engine, no server modules. The
// birth-profile form lazy-loads this to show the read-only birth-chart
// panel as soon as a date of birth is entered.

export interface BirthSnapshot {
  rashi: Rashi;
  /** Zodiac glyph of the rashi's sign, e.g. "♐". */
  rashiSymbol: string;
  moon: string;
  /** Lit fraction of the Moon at birth, 0-1 -- drives the drawn phase. */
  moonIllumination: number;
  moonNakshatra: string;
  saturn: string;
  mars: string;
}

/** Sidereal (Lahiri) Moon / Saturn / Mars placements at a UTC birth instant. */
export function computeBirthSnapshot(birthDateTimeUtc: Date): BirthSnapshot {
  const sidereal = (planet: "moon" | "saturn" | "mars") =>
    tropicalToSidereal(getPlanetPosition(planet, birthDateTimeUtc).longitude, birthDateTimeUtc);
  const moon = sidereal("moon");
  const rashi = rashiForMoon(moon);
  return {
    rashi,
    rashiSymbol: ZODIAC_SIGNS.find((z) => z.name === rashi.sign)?.symbol ?? "",
    moon: formatSignPosition(moon),
    moonIllumination: getMoonPhase(birthDateTimeUtc).illumination,
    moonNakshatra: NAKSHATRAS[nakshatraIndex(moon)],
    saturn: formatSignPosition(sidereal("saturn")),
    mars: formatSignPosition(sidereal("mars")),
  };
}
