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

/**
 * Every rashi the Moon passes through between two UTC instants -- used when
 * only a part of the day is known, to tell the user their rashi could be
 * either of two signs. Sampled every 30 minutes (the Moon moves ~0.27° in
 * that time, so no sign can be skipped).
 */
export function rashisBetween(startUtc: Date, endUtc: Date): Rashi[] {
  const seen = new Map<string, Rashi>();
  const step = 30 * 60 * 1000;
  for (let t = startUtc.getTime(); ; t += step) {
    const at = new Date(Math.min(t, endUtc.getTime()));
    const rashi = rashiForMoon(tropicalToSidereal(getPlanetPosition("moon", at).longitude, at));
    seen.set(rashi.name, rashi);
    if (at.getTime() >= endUtc.getTime()) break;
  }
  return [...seen.values()];
}

/** Zodiac glyph for a sign name, e.g. "Sagittarius" -> "♐". */
export function symbolForSign(sign: string): string {
  return ZODIAC_SIGNS.find((z) => z.name === sign)?.symbol ?? "";
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
