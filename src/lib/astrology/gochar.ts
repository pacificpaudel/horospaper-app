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
  // Phaladeepika ch. 26 sloka 24: Rahu in the 10th brings "gain"; Ketu
  // gives results similar to Rahu (see TRANSIT_RESULTS below).
  rahu: [3, 6, 10, 11],
  ketu: [3, 6, 10, 11],
};

/** How a graha's transit sits in a house counted from the natal Moon sign. */
export type GocharQuality = "good" | "neutral" | "bad";

// Each graha's transit result in houses 1-12 from the natal Moon sign, per
// Mantreswara's Phaladeepika, ch. 26 ("Transits of Planets", slokas 9-24):
// G = the text's favorable houses; for the rest, B where the text names
// disease/sickness/fever, danger, death, fear, or loss of wealth,
// position, honour, relatives or children, and N where its result is
// milder (expenditure, impediments, quarrels, misunderstandings, sorrow,
// "failure, exhaustion"). Ketu "gives results similar to Rahu" (sloka 2).
//              houses: 123456789012
const TRANSIT_RESULTS: Record<Graha, string> = {
  sun: /*         */ "BBGBBGBBBGGB",
  moon: /*        */ "GBGBNGGBBGGN",
  mars: /*        */ "BBGBBGBBBNGB",
  mercury: /*     */ "BGBGNGNGNGGB",
  jupiter: /*     */ "NGBBGBGBGBGB",
  venus: /*       */ "GGGGGBNGGNGG",
  saturn: /*      */ "BBGBBGBBBBGB",
  rahu: /*        */ "BBGNBGBBBGGN",
  ketu: /*        */ "BBGNBGBBBGGN",
};

// Vedha (obstruction): a favorable transit (key) is cancelled while
// another graha transits its paired vedha house (value), both counted from
// the natal Moon -- Phaladeepika ch. 26, slokas 3-8, cross-checked with
// the standard vedha tables (e.g. Moon's 7th pairs with the 2nd). Rahu and
// Ketu "are similar to the Sun" (sloka 2), so they share its pairs.
const SUN_VEDHA: Record<number, number> = { 3: 9, 6: 12, 10: 4, 11: 5 };
const VEDHA: Record<Graha, Record<number, number>> = {
  sun: SUN_VEDHA,
  moon: { 1: 5, 3: 9, 6: 12, 7: 2, 10: 4, 11: 8 },
  mars: { 3: 12, 6: 9, 11: 5 },
  mercury: { 2: 5, 4: 3, 6: 9, 8: 1, 10: 8, 11: 12 },
  jupiter: { 2: 12, 5: 4, 7: 3, 9: 10, 11: 8 },
  venus: { 1: 8, 2: 7, 3: 1, 4: 10, 5: 9, 8: 5, 9: 11, 11: 6, 12: 3 },
  saturn: { 3: 12, 6: 9, 11: 5 },
  rahu: SUN_VEDHA,
  ketu: SUN_VEDHA,
};

// Only the seven planets cause vedha (the classical lists name Sun to
// Saturn), and never between father and son: Sun and Saturn, Moon and
// Mercury (slokas 3-6).
const VEDHA_CASTERS: Graha[] = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"];
const NO_MUTUAL_VEDHA: [Graha, Graha][] = [
  ["sun", "saturn"],
  ["moon", "mercury"],
];

function isObstructed(graha: Graha, house: number, houses: Partial<Record<Graha, number>>): boolean {
  const vedhaHouse = VEDHA[graha][house];
  if (vedhaHouse === undefined) return false;
  return VEDHA_CASTERS.some(
    (other) =>
      other !== graha &&
      houses[other] === vedhaHouse &&
      !NO_MUTUAL_VEDHA.some(([x, y]) => (x === graha && y === other) || (x === other && y === graha))
  );
}

// Phaladeepika ch. 26's stated result for each graha in houses 1-12 from
// the natal Moon, condensed to a few words (slokas 9-24). Ketu as Rahu.
const RAHU_REASONS = [
  "SICKNESS, DANGER", "LOSS OF WEALTH", "HAPPINESS", "SORROW", "FINANCIAL LOSS", "HAPPINESS",
  "LOSS", "DANGER TO LIFE", "LOSS", "GAIN", "HAPPINESS", "EXPENDITURE",
];
const TRANSIT_REASONS: Record<Graha, string[]> = {
  sun: [
    "FATIGUE, LOSS OF WEALTH", "LOSS OF WEALTH, DECEIT", "NEW POSITION, MONEY, HEALTH", "ILLNESS, OBSTACLES",
    "AGITATION, ILL-HEALTH", "ENEMIES AND ILLS DEFEATED", "TIRING TRAVEL, ILLNESS", "FEAR, ILLNESS, QUARRELS",
    "DANGER, HUMILIATION", "GREAT TASKS SUCCEED", "HONOUR, WEALTH, HEALTH", "SORROW, LOSS, FEVER",
  ],
  moon: [
    "FORTUNE DAWNS", "LOSS OF WEALTH", "SUCCESS", "FEAR", "SORROW", "FREEDOM FROM DISEASE",
    "HAPPINESS", "UNTOWARD EVENTS", "SICKNESS", "WISHES FULFILLED", "JOY", "EXPENDITURE",
  ],
  mars: [
    "ILLNESS, SEPARATION", "FEAR, LOSS OF WEALTH", "SUCCESS, HAPPINESS", "LOSS OF POSITION, ILLNESS",
    "FEVER, ANGUISH", "VICTORY OVER ENEMIES, GAIN", "DISCORD, ILLNESS", "FEVER, LOSS OF HONOUR",
    "LOSS OF WEALTH, WEAKNESS", "FAILURE, EXHAUSTION", "GAIN, HEALTH, PROPERTY", "LOSS OF WEALTH, ILLNESS",
  ],
  mercury: [
    "LOSS OF WEALTH", "FINANCIAL GAIN", "FEAR FROM ENEMIES", "MONEY COMES IN", "QUARRELS AT HOME", "SUCCESS",
    "MISUNDERSTANDINGS", "CHILDREN, WEALTH", "IMPEDIMENTS", "HAPPINESS ALL ROUND", "PROSPERITY", "FEAR OF HUMILIATION",
  ],
  jupiter: [
    "HEAVY EXPENSE, TRAVEL", "MONEY, HAPPY HOME", "LOSS OF POSITION, ILLNESS", "HUMILIATION, DANGER",
    "CHILDREN, ROYAL FAVOUR", "ENEMIES, DISEASE", "HAPPY MARRIAGE, GOOD TRAVEL", "MISERY, LOSS OF MONEY",
    "ALL PROSPERITY", "DANGER TO PROPERTY", "HONOUR, NEW POSITION", "GRIEF AND FEAR",
  ],
  venus: [
    "ALL ENJOYMENTS", "FINANCIAL GAIN", "PROSPERITY", "HAPPINESS, FRIENDS", "CHILDREN", "MISHAP",
    "TROUBLE TO SPOUSE", "WEALTH", "HAPPINESS", "QUARRELS", "SAFETY", "MONEY GAINED",
  ],
  saturn: [
    "DISEASE", "TROUBLE TO WEALTH, CHILDREN", "POSITION, SERVANTS, MONEY", "LOSS OF SPOUSE, WEALTH",
    "WEALTH DECLINES", "HAPPINESS ALL ROUND", "SPOUSE SUFFERS, FEAR", "LOSSES, DISEASE",
    "LOSSES, OBSTACLES", "LOSS OF HONOUR, DISEASE", "HAPPINESS, WEALTH, HONOUR", "ROBBED, FAMILY ILLNESS",
  ],
  rahu: RAHU_REASONS,
  ketu: RAHU_REASONS,
};

export interface GocharAssessment {
  quality: GocharQuality;
  /** The classical result for this house, in short. */
  reason: string;
  /** For a favorable transit cancelled by vedha: the graha causing it and its house. */
  blockedBy?: { planet: string; house: number };
}

/**
 * The full verdict behind gocharQuality: the quality, the classical
 * reason, and -- when vedha cancels a favorable transit -- what blocks it.
 * `allHouses` is every graha's current house from the Moon, by English name.
 */
export function gocharAssessment(planetName: string, house: number, allHouses?: Record<string, number>): GocharAssessment {
  const graha = planetName.toLowerCase() as Graha;
  const results = TRANSIT_RESULTS[graha];
  if (!results || house < 1 || house > 12) return { quality: "neutral", reason: "" };
  const reason = TRANSIT_REASONS[graha][house - 1];
  const code = results[house - 1];
  if (code === "G" && allHouses) {
    const vedhaHouse = VEDHA[graha][house];
    const blocker = VEDHA_CASTERS.find(
      (other) =>
        other !== graha &&
        vedhaHouse !== undefined &&
        Object.entries(allHouses).some(([name, h]) => name.toLowerCase() === other && h === vedhaHouse) &&
        !NO_MUTUAL_VEDHA.some(([x, y]) => (x === graha && y === other) || (x === other && y === graha))
    );
    if (blocker) return { quality: "neutral", reason, blockedBy: { planet: blocker[0].toUpperCase() + blocker.slice(1), house: vedhaHouse } };
  }
  return { quality: code === "G" ? "good" : code === "B" ? "bad" : "neutral", reason };
}

/**
 * Good / neutral / bad for a graha (English name, e.g. "Sun", "Rahu") in
 * `house` (1-12) counted from the natal Moon sign (see TRANSIT_RESULTS).
 * With `allHouses` (every graha's current house, by English name), a
 * favorable transit obstructed by vedha reads as neutral -- its good
 * result is cancelled, not turned bad.
 */
export function gocharQuality(planetName: string, house: number, allHouses?: Record<string, number>): GocharQuality {
  const graha = planetName.toLowerCase() as Graha;
  const results = TRANSIT_RESULTS[graha];
  if (!results || house < 1 || house > 12) return "neutral";
  const code = results[house - 1];
  if (code === "G") {
    const houses = Object.fromEntries(Object.entries(allHouses ?? {}).map(([name, h]) => [name.toLowerCase(), h])) as Partial<Record<Graha, number>>;
    return allHouses && isObstructed(graha, house, houses) ? "neutral" : "good";
  }
  return code === "B" ? "bad" : "neutral";
}

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
export function meanRahuLongitude(date: Date): number {
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
  const grahas = Object.keys(FAVORABLE_HOUSES) as Graha[];
  const houses = Object.fromEntries(grahas.map((graha) => [graha, houseFrom(natalSign, today[graha])])) as Record<Graha, number>;
  const placements = grahas.map((graha) => {
    const house = houses[graha];
    // A favorable transit obstructed by vedha counts as neither for nor against.
    const obstructed = FAVORABLE_HOUSES[graha].includes(house) && isObstructed(graha, house, houses);
    const favorable = FAVORABLE_HOUSES[graha].includes(house) && !obstructed;
    weighted += (favorable ? 1 : obstructed ? 0 : -1) * WEIGHTS[graha];
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
