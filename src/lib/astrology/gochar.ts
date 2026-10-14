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

// The same results in Nepali, entry for entry.
const RAHU_REASONS_NE = ["रोग, खतरा", "धन हानि", "सुख", "दुःख", "आर्थिक हानि", "सुख", "हानि", "प्राणको खतरा", "हानि", "लाभ", "सुख", "खर्च"];
const TRANSIT_REASONS_NE: Record<Graha, string[]> = {
  sun: [
    "थकान, धन हानि", "धन हानि, छल", "नयाँ पद, धन, स्वास्थ्य", "रोग, बाधा",
    "अशान्ति, अस्वस्थता", "शत्रु र रोगमाथि विजय", "थकाउने यात्रा, रोग", "डर, रोग, झगडा",
    "खतरा, अपमान", "ठूला काममा सफलता", "सम्मान, धन, स्वास्थ्य", "दुःख, हानि, ज्वरो",
  ],
  moon: ["भाग्योदय", "धन हानि", "सफलता", "डर", "दुःख", "रोगमुक्ति", "सुख", "अप्रिय घटना", "बिरामी", "इच्छा पूरा", "आनन्द", "खर्च"],
  mars: [
    "रोग, वियोग", "डर, धन हानि", "सफलता, सुख", "पद हानि, रोग",
    "ज्वरो, पीडा", "शत्रुमाथि विजय, लाभ", "कलह, रोग", "ज्वरो, मान हानि",
    "धन हानि, कमजोरी", "असफलता, थकावट", "लाभ, स्वास्थ्य, सम्पत्ति", "धन हानि, रोग",
  ],
  mercury: [
    "धन हानि", "आर्थिक लाभ", "शत्रुबाट डर", "धन आगमन", "घरमा झगडा", "सफलता",
    "गलतफहमी", "सन्तान, धन", "अवरोध", "चारैतिर सुख", "समृद्धि", "अपमानको डर",
  ],
  jupiter: [
    "भारी खर्च, यात्रा", "धन, सुखी घर", "पद हानि, रोग", "अपमान, खतरा",
    "सन्तान, राजकृपा", "शत्रु, रोग", "सुखी विवाह, राम्रो यात्रा", "कष्ट, धन हानि",
    "सर्व समृद्धि", "सम्पत्तिमा खतरा", "सम्मान, नयाँ पद", "शोक र डर",
  ],
  venus: ["सबै सुखभोग", "आर्थिक लाभ", "समृद्धि", "सुख, मित्र", "सन्तान", "दुर्घटना", "जीवनसाथीलाई कष्ट", "धन", "सुख", "झगडा", "सुरक्षा", "धन प्राप्ति"],
  saturn: [
    "रोग", "धन र सन्तानमा कष्ट", "पद, सेवक, धन", "जीवनसाथी र धनको हानि",
    "धनमा ह्रास", "चारैतिर सुख", "जीवनसाथीलाई कष्ट, डर", "हानि, रोग",
    "हानि, बाधा", "मान हानि, रोग", "सुख, धन, सम्मान", "चोरी, परिवारमा रोग",
  ],
  rahu: RAHU_REASONS_NE,
  ketu: RAHU_REASONS_NE,
};

/** The areas of life the transit results speak to, for comparing grahas' readings. */
export const GOCHAR_THEMES = {
  W: { en: "WEALTH", ne: "धन" },
  H: { en: "HEALTH", ne: "स्वास्थ्य" },
  J: { en: "HAPPINESS", ne: "सुख" },
  S: { en: "STATUS", ne: "पद, मान" },
  F: { en: "FAMILY", ne: "परिवार" },
  U: { en: "SUCCESS", ne: "सफलता" },
  P: { en: "SAFETY", ne: "सुरक्षा" },
} as const;
export type GocharTheme = keyof typeof GOCHAR_THEMES;

// Which areas each result (English, as in TRANSIT_REASONS) speaks to, as
// GOCHAR_THEMES letters. Whether it speaks for or against them is the
// transit's own quality: good results for, bad (and neutral) against.
const REASON_THEMES: Record<string, string> = {
  "SICKNESS, DANGER": "HP", "LOSS OF WEALTH": "W", HAPPINESS: "J", SORROW: "J", "FINANCIAL LOSS": "W",
  LOSS: "W", "DANGER TO LIFE": "HP", GAIN: "W", EXPENDITURE: "W",
  "FATIGUE, LOSS OF WEALTH": "HW", "LOSS OF WEALTH, DECEIT": "WP", "NEW POSITION, MONEY, HEALTH": "SWH",
  "ILLNESS, OBSTACLES": "HU", "AGITATION, ILL-HEALTH": "PH", "ENEMIES AND ILLS DEFEATED": "PH",
  "TIRING TRAVEL, ILLNESS": "H", "FEAR, ILLNESS, QUARRELS": "PH", "DANGER, HUMILIATION": "PS",
  "GREAT TASKS SUCCEED": "U", "HONOUR, WEALTH, HEALTH": "SWH", "SORROW, LOSS, FEVER": "JWH",
  "FORTUNE DAWNS": "WU", SUCCESS: "U", FEAR: "P", "FREEDOM FROM DISEASE": "H", "UNTOWARD EVENTS": "P",
  SICKNESS: "H", "WISHES FULFILLED": "U", JOY: "J",
  "ILLNESS, SEPARATION": "HF", "FEAR, LOSS OF WEALTH": "PW", "SUCCESS, HAPPINESS": "UJ",
  "LOSS OF POSITION, ILLNESS": "SH", "FEVER, ANGUISH": "HJ", "VICTORY OVER ENEMIES, GAIN": "PW",
  "DISCORD, ILLNESS": "FH", "FEVER, LOSS OF HONOUR": "HS", "LOSS OF WEALTH, WEAKNESS": "WH",
  "FAILURE, EXHAUSTION": "UH", "GAIN, HEALTH, PROPERTY": "WH", "LOSS OF WEALTH, ILLNESS": "WH",
  "FINANCIAL GAIN": "W", "FEAR FROM ENEMIES": "P", "MONEY COMES IN": "W", "QUARRELS AT HOME": "F",
  MISUNDERSTANDINGS: "F", "CHILDREN, WEALTH": "FW", IMPEDIMENTS: "U", "HAPPINESS ALL ROUND": "J",
  PROSPERITY: "W", "FEAR OF HUMILIATION": "S",
  "HEAVY EXPENSE, TRAVEL": "W", "MONEY, HAPPY HOME": "WF", "HUMILIATION, DANGER": "SP",
  "CHILDREN, ROYAL FAVOUR": "FS", "ENEMIES, DISEASE": "PH", "HAPPY MARRIAGE, GOOD TRAVEL": "FJ",
  "MISERY, LOSS OF MONEY": "JW", "ALL PROSPERITY": "W", "DANGER TO PROPERTY": "W",
  "HONOUR, NEW POSITION": "S", "GRIEF AND FEAR": "JP",
  "ALL ENJOYMENTS": "J", "HAPPINESS, FRIENDS": "JF", CHILDREN: "F", MISHAP: "P", "TROUBLE TO SPOUSE": "F",
  WEALTH: "W", QUARRELS: "F", SAFETY: "P", "MONEY GAINED": "W",
  DISEASE: "H", "TROUBLE TO WEALTH, CHILDREN": "WF", "POSITION, SERVANTS, MONEY": "SW",
  "LOSS OF SPOUSE, WEALTH": "FW", "WEALTH DECLINES": "W", "SPOUSE SUFFERS, FEAR": "FP", "LOSSES, DISEASE": "WH",
  "LOSSES, OBSTACLES": "WU", "LOSS OF HONOUR, DISEASE": "SH", "HAPPINESS, WEALTH, HONOUR": "JWS",
  "ROBBED, FAMILY ILLNESS": "WF",
};

// How much each graha's reading weighs when two disagree: the slower the
// transit, the longer and stronger its result -- Saturn's ~2.5 years in a
// sign outweighs the Sun's month, which outweighs the Moon's 2.5 days.
const GRAHA_WEIGHT: Record<Graha, number> = { saturn: 5, rahu: 4, ketu: 4, jupiter: 4, mars: 3, sun: 2, venus: 2, mercury: 2, moon: 1 };
// Neutral results are the milder setbacks (expense, sorrow, quarrels): they
// count against an area at half weight.
const NEUTRAL_SHARE = 0.5;

/** One area two or more grahas' readings speak to, and how it comes out. */
export interface GocharThemeReading {
  theme: GocharTheme;
  /** All agree; one side outweighs the other; or the two sides weigh the same. */
  kind: "agree" | "conflict" | "balanced";
  /** The outcome: the agreeing or winning side's ("neutral" when balanced). */
  quality: GocharQuality;
  /** The agreeing or winning grahas (both sides when balanced), heaviest first. */
  winners: string[];
  /** The outweighed grahas (none unless kind is "conflict"). */
  losers: string[];
}

/**
 * Compares every graha's reading by the areas of life it speaks to: each
 * area two or more grahas speak to, agreeing or not, and the grahas
 * `outweighed` -- those on the losing side of some conflict and the winning
 * side of none. Vedha-blocked grahas don't take part (their result is
 * cancelled). `allHouses` is every graha's current house from the Moon, by
 * English name.
 */
export function gocharThemeReadings(allHouses: Record<string, number>): { themes: GocharThemeReading[]; outweighed: Set<string> } {
  type Voice = { name: string; weight: number; good: boolean };
  const voices = new Map<GocharTheme, Voice[]>();
  for (const [name, house] of Object.entries(allHouses)) {
    const graha = name.toLowerCase() as Graha;
    if (!GRAHA_WEIGHT[graha]) continue;
    const { quality, reason, blockedBy } = gocharAssessment(name, house, allHouses);
    if (blockedBy) continue;
    for (const letter of REASON_THEMES[reason] ?? "") {
      const theme = letter as GocharTheme;
      const voice = { name, weight: GRAHA_WEIGHT[graha] * (quality === "neutral" ? NEUTRAL_SHARE : 1), good: quality === "good" };
      voices.set(theme, [...(voices.get(theme) ?? []), voice]);
    }
  }
  const heaviestFirst = (list: Voice[]) => [...list].sort((a, b) => b.weight - a.weight).map((voice) => voice.name);
  const sum = (list: Voice[]) => list.reduce((total, voice) => total + voice.weight, 0);
  const themes: GocharThemeReading[] = [];
  const lost = new Set<string>();
  const won = new Set<string>();
  for (const theme of Object.keys(GOCHAR_THEMES) as GocharTheme[]) {
    const list = voices.get(theme) ?? [];
    if (list.length < 2) continue;
    const good = list.filter((voice) => voice.good);
    const bad = list.filter((voice) => !voice.good);
    if (!good.length || !bad.length) {
      themes.push({ theme, kind: "agree", quality: good.length ? "good" : "bad", winners: heaviestFirst(list), losers: [] });
    } else if (sum(good) === sum(bad)) {
      themes.push({ theme, kind: "balanced", quality: "neutral", winners: heaviestFirst(list), losers: [] });
    } else {
      const [winners, losers] = sum(good) > sum(bad) ? [good, bad] : [bad, good];
      themes.push({ theme, kind: "conflict", quality: winners === good ? "good" : "bad", winners: heaviestFirst(winners), losers: heaviestFirst(losers) });
      winners.forEach((voice) => won.add(voice.name));
      losers.forEach((voice) => lost.add(voice.name));
    }
  }
  return { themes, outweighed: new Set([...lost].filter((name) => !won.has(name))) };
}

/** In Nepali, a favorable transit cancelled by vedha: "good house, blocked by vedha". */
export const VEDHA_BLOCKED_NE = "शुभ भाव, वेधले रोकियो";

/** Every Nepali reason gocharAssessment can give (plus VEDHA_BLOCKED_NE and the themes' names), e.g. to shape them ahead of drawing. */
export function nepaliReasonTexts(): string[] {
  return [...new Set([...Object.values(TRANSIT_REASONS_NE).flat(), VEDHA_BLOCKED_NE, ...Object.values(GOCHAR_THEMES).map((theme) => theme.ne)])];
}

export interface GocharAssessment {
  quality: GocharQuality;
  /** The classical result for this house, in short. */
  reason: string;
  /** The same in Nepali. */
  reasonNe: string;
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
  if (!results || house < 1 || house > 12) return { quality: "neutral", reason: "", reasonNe: "" };
  const reason = TRANSIT_REASONS[graha][house - 1];
  const reasonNe = TRANSIT_REASONS_NE[graha][house - 1];
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
    if (blocker) return { quality: "neutral", reason, reasonNe, blockedBy: { planet: blocker[0].toUpperCase() + blocker.slice(1), house: vedhaHouse } };
  }
  return { quality: code === "G" ? "good" : code === "B" ? "bad" : "neutral", reason, reasonNe };
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
