import { PlanetKey, PLANET_LABELS } from "./constants";
import { getPlanetPosition } from "./ephemeris";
import { normalizeDegrees, tropicalToSidereal } from "./zodiac";
import { nakshatraIndex, NAKSHATRAS, signIndex } from "./rashi";

// Classical Vedic gochar (transit) reading: every graha's *sidereal* sign
// is counted as a house from the natal Moon sign (the rashi), and each
// graha has a traditional set of houses where its transit is favorable.
// Tara bala (today's Moon nakshatra counted from the birth nakshatra) adds
// the day-to-day swing the slower planets can't provide.

type Graha = "sun" | "moon" | "mars" | "mercury" | "jupiter" | "venus" | "saturn" | "rahu" | "ketu";

const FAVORABLE_HOUSES: Record<Graha, number[]> = {
  sun: [3, 6, 10, 11],
  moon: [1, 3, 6, 7, 10, 11],
  mars: [3, 6, 11],
  mercury: [2, 4, 6, 8, 10, 11],
  jupiter: [2, 5, 7, 9, 11],
  venus: [1, 2, 3, 4, 5, 8, 9, 11, 12],
  saturn: [3, 6, 11],
  rahu: [3, 6, 11],
  ketu: [3, 6, 11],
};

// The Moon sets the day's tone (it changes sign every ~2.5 days); the slow
// benefic/malefic pair Jupiter and Saturn set the background.
const WEIGHTS: Record<Graha, number> = {
  moon: 3,
  jupiter: 2.5,
  saturn: 2.5,
  sun: 1.5,
  mars: 1.5,
  venus: 1.2,
  mercury: 1.2,
  rahu: 1,
  ketu: 1,
};

// Tara bala: position (1-9) of today's Moon nakshatra in the repeating
// 9-star cycle counted from the birth nakshatra.
const TARAS: { name: string; score: number }[] = [
  { name: "Janma", score: -0.3 },
  { name: "Sampat", score: 0.8 },
  { name: "Vipat", score: -0.8 },
  { name: "Kshema", score: 0.7 },
  { name: "Pratyari", score: -0.7 },
  { name: "Sadhana", score: 0.8 },
  { name: "Naidhana", score: -1 },
  { name: "Mitra", score: 0.7 },
  { name: "Parama Mitra", score: 1 },
];

/** Life area the Moon's transit house from the natal Moon highlights. */
export const HOUSE_THEMES: Record<number, string> = {
  1: "self and vitality",
  2: "wealth, family and speech",
  3: "courage, effort and short journeys",
  4: "home, comfort and mother",
  5: "creativity, romance and intellect",
  6: "work, health and overcoming rivals",
  7: "partnership and public dealings",
  8: "obstacles, hidden matters and transformation",
  9: "fortune, blessings and long journeys",
  10: "career and public action",
  11: "gains, friends and fulfilled wishes",
  12: "expenses, rest and spiritual retreat",
};

export interface GocharPlacement {
  graha: string;
  house: number;
  favorable: boolean;
}

export interface GocharReading {
  placements: GocharPlacement[];
  /** Weighted gochar balance, -1 (all unfavorable) .. 1 (all favorable). */
  gocharScore: number;
  tara: { name: string; score: number };
  moonNakshatra: string;
  moonHouse: number;
  /** Moon transiting the 8th from the natal Moon -- a classically difficult day. */
  chandrashtama: boolean;
  /** Saturn in the 12th, 1st or 2nd from the natal Moon. */
  sadeSati: boolean;
  /** Combined planetary score, -1 .. 1. */
  score: number;
}

/**
 * Mean longitude of the Moon's ascending node (Rahu), tropical degrees.
 * Meeus' low-order series -- well within a degree, which is plenty for a
 * whole-sign house count.
 */
function meanRahuLongitude(date: Date): number {
  const julianCenturies = (date.getTime() / 86400000 + 2440587.5 - 2451545.0) / 36525;
  return normalizeDegrees(125.04452 - 1934.136261 * julianCenturies);
}

function siderealLongitudes(date: Date): Record<Graha, number> {
  const sidereal = (planet: PlanetKey) => tropicalToSidereal(getPlanetPosition(planet, date).longitude, date);
  const rahu = tropicalToSidereal(meanRahuLongitude(date), date);
  return {
    sun: sidereal("sun"),
    moon: sidereal("moon"),
    mars: sidereal("mars"),
    mercury: sidereal("mercury"),
    jupiter: sidereal("jupiter"),
    venus: sidereal("venus"),
    saturn: sidereal("saturn"),
    rahu,
    ketu: normalizeDegrees(rahu + 180),
  };
}

function houseFrom(natalSignIndex: number, longitude: number): number {
  return ((signIndex(longitude) - natalSignIndex + 12) % 12) + 1;
}

function grahaLabel(graha: Graha): string {
  return graha === "rahu" ? "Rahu" : graha === "ketu" ? "Ketu" : PLANET_LABELS[graha];
}

/**
 * Reads the day's transits against a natal chart. `natalMoonSidereal` must
 * be the Lahiri-corrected natal Moon longitude; `at` is the instant the
 * day is judged at (the user's local day anchored to noon UTC).
 */
export function computeGochar(natalMoonSidereal: number, at: Date): GocharReading {
  const natalSign = signIndex(natalMoonSidereal);
  const today = siderealLongitudes(at);

  let weighted = 0;
  let totalWeight = 0;
  const placements = (Object.keys(FAVORABLE_HOUSES) as Graha[]).map((graha) => {
    const house = houseFrom(natalSign, today[graha]);
    const favorable = FAVORABLE_HOUSES[graha].includes(house);
    weighted += (favorable ? 1 : -1) * WEIGHTS[graha];
    totalWeight += WEIGHTS[graha];
    return { graha: grahaLabel(graha), house, favorable };
  });
  const gocharScore = weighted / totalWeight;

  const birthStar = nakshatraIndex(natalMoonSidereal);
  const todayStar = nakshatraIndex(today.moon);
  const tara = TARAS[((todayStar - birthStar + 27) % 27) % 9];

  const moonHouse = houseFrom(natalSign, today.moon);
  const saturnHouse = houseFrom(natalSign, today.saturn);
  const chandrashtama = moonHouse === 8;
  const sadeSati = saturnHouse === 12 || saturnHouse === 1 || saturnHouse === 2;

  // Gochar gives the multi-day background, tara bala the daily swing;
  // chandrashtama is the one strong single-day override in the tradition.
  let score = gocharScore * 0.55 + tara.score * 0.45;
  if (chandrashtama) score -= 0.3;
  if (sadeSati) score -= 0.08;

  return {
    placements,
    gocharScore: Math.round(gocharScore * 100) / 100,
    tara,
    moonNakshatra: NAKSHATRAS[todayStar],
    moonHouse,
    chandrashtama,
    sadeSati,
    score: Math.max(-1, Math.min(1, Math.round(score * 100) / 100)),
  };
}
