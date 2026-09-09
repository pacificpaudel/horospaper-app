import { Body } from "astronomy-engine";

export type ZodiacSignName =
  | "Aries"
  | "Taurus"
  | "Gemini"
  | "Cancer"
  | "Leo"
  | "Virgo"
  | "Libra"
  | "Scorpio"
  | "Sagittarius"
  | "Capricorn"
  | "Aquarius"
  | "Pisces";

export interface ZodiacSign {
  name: ZodiacSignName;
  symbol: string;
  element: "Fire" | "Earth" | "Air" | "Water";
  modality: "Cardinal" | "Fixed" | "Mutable";
  startDegree: number; // tropical ecliptic longitude, 0 = 0 Aries
}

// Tropical zodiac: 12 signs of 30 degrees each, starting at 0 Aries.
export const ZODIAC_SIGNS: ZodiacSign[] = [
  { name: "Aries", symbol: "♈", element: "Fire", modality: "Cardinal", startDegree: 0 },
  { name: "Taurus", symbol: "♉", element: "Earth", modality: "Fixed", startDegree: 30 },
  { name: "Gemini", symbol: "♊", element: "Air", modality: "Mutable", startDegree: 60 },
  { name: "Cancer", symbol: "♋", element: "Water", modality: "Cardinal", startDegree: 90 },
  { name: "Leo", symbol: "♌", element: "Fire", modality: "Fixed", startDegree: 120 },
  { name: "Virgo", symbol: "♍", element: "Earth", modality: "Mutable", startDegree: 150 },
  { name: "Libra", symbol: "♎", element: "Air", modality: "Cardinal", startDegree: 180 },
  { name: "Scorpio", symbol: "♏", element: "Water", modality: "Fixed", startDegree: 210 },
  { name: "Sagittarius", symbol: "♐", element: "Fire", modality: "Mutable", startDegree: 240 },
  { name: "Capricorn", symbol: "♑", element: "Earth", modality: "Cardinal", startDegree: 270 },
  { name: "Aquarius", symbol: "♒", element: "Air", modality: "Fixed", startDegree: 300 },
  { name: "Pisces", symbol: "♓", element: "Water", modality: "Mutable", startDegree: 330 },
];

// Approximate mean ayanamsa (Lahiri) offset in degrees for a given year,
// used to convert tropical longitudes to sidereal (Vedic) longitudes.
// Lahiri ayanamsa was ~23.85 deg in 2000 and precesses ~50.29"/year (~0.01397 deg/yr).
export function lahiriAyanamsaDegrees(date: Date): number {
  const year = date.getUTCFullYear() + (date.getUTCMonth() + 1) / 12;
  const yearsSince2000 = year - 2000;
  return 23.8563 + yearsSince2000 * 0.013972;
}

export type PlanetKey =
  | "sun"
  | "moon"
  | "mercury"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"
  | "pluto";

export const PLANET_BODIES: Record<PlanetKey, Body> = {
  sun: Body.Sun,
  moon: Body.Moon,
  mercury: Body.Mercury,
  venus: Body.Venus,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
  pluto: Body.Pluto,
};

export const PLANET_LABELS: Record<PlanetKey, string> = {
  sun: "Sun",
  moon: "Moon",
  mercury: "Mercury",
  venus: "Venus",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn",
  uranus: "Uranus",
  neptune: "Neptune",
  pluto: "Pluto",
};

export const PLANET_SYMBOLS: Record<PlanetKey, string> = {
  sun: "☉",
  moon: "☽",
  mercury: "☿",
  venus: "♀",
  mars: "♂",
  jupiter: "♃",
  saturn: "♄",
  uranus: "♅",
  neptune: "♆",
  pluto: "♇",
};

// Planets that can never appear retrograde as seen from Earth.
export const NEVER_RETROGRADE: PlanetKey[] = ["sun", "moon"];

export interface AspectDefinition {
  name: string;
  angle: number;
  orb: number;
  nature: "harmonious" | "challenging" | "neutral";
}

export const ASPECTS: AspectDefinition[] = [
  { name: "Conjunction", angle: 0, orb: 8, nature: "neutral" },
  { name: "Sextile", angle: 60, orb: 4, nature: "harmonious" },
  { name: "Square", angle: 90, orb: 6, nature: "challenging" },
  { name: "Trine", angle: 120, orb: 6, nature: "harmonious" },
  { name: "Opposition", angle: 180, orb: 8, nature: "challenging" },
];

export const MOON_PHASE_NAMES = [
  "New Moon",
  "Waxing Crescent",
  "First Quarter",
  "Waxing Gibbous",
  "Full Moon",
  "Waning Gibbous",
  "Last Quarter",
  "Waning Crescent",
] as const;
