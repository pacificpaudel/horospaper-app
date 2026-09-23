import { ZODIAC_SIGNS, ZodiacSignName } from "./constants";
import { normalizeDegrees } from "./zodiac";

// Client-safe (no redis/server imports) -- used by both the birth-profile
// form's read-only birth-chart panel and the server's daily reading.

export interface Rashi {
  sign: ZodiacSignName;
  /** Romanized Nepali rashi name, e.g. "Mesh". */
  name: string;
  /** Devanagari rashi name, e.g. "मेष". */
  nepali: string;
  /** Hamro Patro's URL slug for this rashi's daily rashifal page. */
  slug: string;
}

export const RASHIS: Rashi[] = [
  { sign: "Aries", name: "Mesh", nepali: "मेष", slug: "mesh" },
  { sign: "Taurus", name: "Brish", nepali: "वृष", slug: "brish" },
  { sign: "Gemini", name: "Mithun", nepali: "मिथुन", slug: "mithun" },
  { sign: "Cancer", name: "Karkat", nepali: "कर्कट", slug: "karkat" },
  { sign: "Leo", name: "Singha", nepali: "सिंह", slug: "singha" },
  { sign: "Virgo", name: "Kanya", nepali: "कन्या", slug: "kanya" },
  { sign: "Libra", name: "Tula", nepali: "तुला", slug: "tula" },
  { sign: "Scorpio", name: "Brischik", nepali: "वृश्चिक", slug: "brischik" },
  { sign: "Sagittarius", name: "Dhanu", nepali: "धनु", slug: "dhanu" },
  { sign: "Capricorn", name: "Makar", nepali: "मकर", slug: "makar" },
  { sign: "Aquarius", name: "Kumbha", nepali: "कुम्भ", slug: "kumbha" },
  { sign: "Pisces", name: "Meen", nepali: "मीन", slug: "meen" },
];

export const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha",
  "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
] as const;

const NAKSHATRA_SPAN = 360 / 27;

/** Index 0-11 of the sign a longitude falls in. */
export function signIndex(longitude: number): number {
  return Math.floor(normalizeDegrees(longitude) / 30);
}

/**
 * In Nepali/Vedic practice a person's rashi is their *sidereal Moon sign* --
 * so `siderealMoonLongitude` must already be Lahiri-corrected.
 */
export function rashiForMoon(siderealMoonLongitude: number): Rashi {
  return RASHIS[signIndex(siderealMoonLongitude)];
}

export function rashiForSign(sign: ZodiacSignName): Rashi {
  return RASHIS[ZODIAC_SIGNS.findIndex((z) => z.name === sign)];
}

/** Index 0-26 of the nakshatra (lunar mansion) a sidereal longitude falls in. */
export function nakshatraIndex(siderealLongitude: number): number {
  return Math.floor(normalizeDegrees(siderealLongitude) / NAKSHATRA_SPAN) % 27;
}

/** "Leo 12°04′" style label for a longitude. */
export function formatSignPosition(longitude: number): string {
  const lon = normalizeDegrees(longitude);
  const sign = ZODIAC_SIGNS[signIndex(lon)];
  const inSign = lon - sign.startDegree;
  let degrees = Math.floor(inSign);
  let minutes = Math.round((inSign - degrees) * 60);
  if (minutes === 60) {
    degrees += 1;
    minutes = 0;
  }
  return `${sign.name} ${degrees}°${String(minutes).padStart(2, "0")}′`;
}
