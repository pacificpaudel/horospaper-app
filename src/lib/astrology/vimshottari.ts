import { normalizeDegrees } from "./zodiac";

// Vimshottari dasha: a 120-year cycle of 9 planetary periods. The cycle
// starts at the lord of the natal Moon's nakshatra, with only the part of
// that first period the Moon hadn't yet traversed left at birth. Used as
// the fallback when freeastrologyapi.com's maha-dasas aren't available.

const LORDS = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
const YEARS = [7, 20, 6, 10, 7, 18, 16, 19, 17];
const NAKSHATRA_SPAN = 360 / 27;
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

export interface Mahadasha {
  lord: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

/** The 9 Mahadashas from the one running at birth, as dated periods. */
export function vimshottariMahadashas(moonSidereal: number, birthUtc: Date): Mahadasha[] {
  const position = normalizeDegrees(moonSidereal) / NAKSHATRA_SPAN;
  const nakshatra = Math.floor(position) % 27;
  const traversed = position - Math.floor(position);
  const first = nakshatra % 9;

  const periods: Mahadasha[] = [];
  // The first period began before birth, by the share already traversed.
  let start = birthUtc.getTime() - traversed * YEARS[first] * YEAR_MS;
  for (let i = 0; i < 9; i++) {
    const lord = (first + i) % 9;
    const end = start + YEARS[lord] * YEAR_MS;
    periods.push({ lord: LORDS[lord], start: new Date(start).toISOString().slice(0, 10), end: new Date(end).toISOString().slice(0, 10) });
    start = end;
  }
  return periods;
}

/** The period covering `date` ("YYYY-MM-DD"), if any. */
export function mahadashaOn(periods: Mahadasha[] | null | undefined, date: string): Mahadasha | null {
  return periods?.find((p) => p.start <= date && date < p.end) ?? null;
}
