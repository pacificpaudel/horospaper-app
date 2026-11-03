import { getExistingHoroscope } from "@/lib/horoscope";
import { buildLuckChartViewSvg } from "@/lib/image/gocharOverlay";

export const MIN_SIDE = 200;
export const MAX_SIDE = 2400;

/** Whether a side length from a client is one we'll draw for. */
export const sideOk = (n: number) => Number.isFinite(n) && n >= MIN_SIDE && n <= MAX_SIDE;

/**
 * One stored day's Luck Chart view -- the same drawing the full-screen
 * view shows -- rasterized to PNG, or null if that day has no chart.
 * Shared by the endpoint that makes a calendar event and the OAuth
 * callback that finishes one.
 */
export async function renderLuckChartPng(userId: string, date: string, width: number, height: number, preview: boolean): Promise<Buffer | null> {
  const horoscope = await getExistingHoroscope(userId, new Date(`${date}T00:00:00Z`), preview);
  const kundli = horoscope?.dailyReading?.kundli;
  if (!horoscope?.dailyReading || !kundli) return null;
  const { svg } = await buildLuckChartViewSvg(width, height, kundli, horoscope.generationDate, horoscope.dailyReading.panchang);
  const sharp = (await import("sharp")).default;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
