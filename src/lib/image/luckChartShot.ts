import { getExistingHoroscope } from "@/lib/horoscope";
import { buildLuckChartViewSvg } from "@/lib/image/gocharOverlay";
import { PHYSICAL_SYMPTOMS, type PhysicalSymptomRatings } from "@/lib/physicalSymptoms";
import { getDailyPhysicalSymptoms } from "@/lib/physicalSymptomLog";
import { getArchivedCalendarDay } from "@/lib/userCalendar";

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
function escapeXml(text: string): string {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" };
  return text.replace(/[&<>"']/g, (char) => entities[char]);
}

export function symptomsFooter(width: number, y: number, ids: readonly string[], ratings: PhysicalSymptomRatings): { height: number; markup: string } | undefined {
  const symptoms = ids.flatMap((id) => {
    const symptom = PHYSICAL_SYMPTOMS.find((item) => item.id === id);
    return symptom ? [{ symptom, rating: ratings[symptom.id] }] : [];
  });
  if (!symptoms.length) return undefined;

  const pad = Math.max(16, Math.round(width * 0.045));
  const headerSize = Math.max(11, Math.min(18, width * 0.038));
  const rowSize = Math.max(10, Math.min(16, width * 0.033));
  const rowHeight = Math.max(28, Math.round(rowSize * 2.1));
  const height = Math.ceil(pad + headerSize * 1.8 + symptoms.length * rowHeight + pad * 0.6);
  const badgeWidth = Math.max(68, Math.round(rowSize * 5.8));
  const labelWidth = Math.max(1, width - pad * 2 - badgeWidth - 12);
  const rows = symptoms.map(({ symptom, rating }, index) => {
    const rowY = y + pad + headerSize * 1.8 + index * rowHeight;
    const status = rating === "right" ? "RIGHT" : rating === "wrong" ? "WRONG" : "UNRATED";
    const color = rating === "right" ? "#4ade80" : rating === "wrong" ? "#f87171" : "#a9b1c4";
    const fill = rating === "right" ? "#14532d" : rating === "wrong" ? "#7f1d1d" : "#1f2937";
    return `<rect x="${width - pad - badgeWidth}" y="${rowY - rowHeight * 0.34}" width="${badgeWidth}" height="${rowHeight * 0.68}" rx="${rowHeight * 0.34}" fill="${fill}" stroke="${color}" stroke-width="1"/><text x="${width - pad - badgeWidth / 2}" y="${rowY}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="${rowSize * 0.75}" font-weight="700" letter-spacing="0.5" fill="${color}">${status}</text>`;
  });
  const labels = symptoms.map(({ symptom }, index) => {
    const rowY = y + pad + headerSize * 1.8 + index * rowHeight;
    return `<text x="${pad}" y="${rowY}" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="${rowSize}" fill="#f3f5fa">${escapeXml(symptom.figure)}  ${escapeXml(`${symptom.body} · ${symptom.indicator}`)}</text>`;
  });
  const markup = `<defs><clipPath id="luck-chart-symptom-label-clip"><rect x="${pad}" y="${y}" width="${labelWidth}" height="${height}"/></clipPath></defs><rect x="0" y="${y}" width="${width}" height="${height}" fill="#080b16"/><path d="M ${pad} ${y + 1} H ${width - pad}" stroke="#f7c56a" stroke-opacity="0.55"/><text x="${pad}" y="${y + pad + headerSize}" font-family="Arial, sans-serif" font-size="${headerSize}" font-weight="700" letter-spacing="1" fill="#f7c56a">BODY SIGN MATCHES</text><g clip-path="url(#luck-chart-symptom-label-clip)">${labels.join("")}</g>${rows.join("")}`;
  return { height, markup };
}

export async function renderLuckChartPng(
  userId: string,
  date: string,
  width: number,
  height: number,
  preview: boolean,
  symptoms: readonly string[] = [],
  ratings: PhysicalSymptomRatings = {},
): Promise<Buffer | null> {
  const horoscope = await getExistingHoroscope(userId, new Date(`${date}T00:00:00Z`), preview);
  const archived = !horoscope && !preview ? await getArchivedCalendarDay(userId, date) : null;
  const reading = horoscope?.dailyReading ?? archived?.reading;
  const kundli = reading?.kundli;
  if (!reading || !kundli) return null;
  const symptomLog = await getDailyPhysicalSymptoms(userId, date);
  const snapshotSymptoms = symptoms.length ? symptoms : symptomLog?.symptoms ?? [];
  const snapshotRatings = { ...symptomLog?.ratings, ...ratings };
  const footer = symptomsFooter(width, height, snapshotSymptoms, snapshotRatings);
  const { svg } = await buildLuckChartViewSvg(width, height, kundli, horoscope?.generationDate ?? archived!.date, reading.panchang, footer);
  const sharp = (await import("sharp")).default;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
