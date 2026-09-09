import { ZODIAC_SIGNS, ZodiacSignName, lahiriAyanamsaDegrees } from "./constants";

export function normalizeDegrees(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

export interface SignPosition {
  sign: ZodiacSignName;
  symbol: string;
  degreeInSign: number; // 0-30
  longitude: number; // 0-360 tropical (or sidereal if converted)
}

export function longitudeToSign(longitude: number): SignPosition {
  const lon = normalizeDegrees(longitude);
  const index = Math.floor(lon / 30);
  const zodiac = ZODIAC_SIGNS[index];
  return {
    sign: zodiac.name,
    symbol: zodiac.symbol,
    degreeInSign: lon - zodiac.startDegree,
    longitude: lon,
  };
}

/** Converts a tropical ecliptic longitude to sidereal (Vedic) using the Lahiri ayanamsa. */
export function tropicalToSidereal(tropicalLongitude: number, date: Date): number {
  return normalizeDegrees(tropicalLongitude - lahiriAyanamsaDegrees(date));
}

export function angularDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
  return diff > 180 ? 360 - diff : diff;
}
