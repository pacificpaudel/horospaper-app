import type { DailyReading } from "@/lib/dailyReading";
import { shapeDevanagariLines, shapeDevanagariText, ShapedText } from "./devanagariShaper";

// The day's Panchang on the wallpaper, as two pieces of the gochar block
// (see wallpaperLayout.ts): its facts as one comma-separated line right
// under the "भाग्य कुन्डली / LUCK CHART" caption, and the LLM's interpretation of
// those facts as a wide strip below the chart. Facts (tithi/nakshatra/yoga,
// in Devanagari -- see panchang.ts's language: "hi") come straight from
// freeastroapi.com; the summary is shown only when that interpretation
// succeeded, never fabricated here. Every label is real HarfBuzz-shaped
// Devanagari (devanagariShaper.ts), not the Latin-only vector font, so
// conjuncts and matras render cleanly.

// Devanagari's visual "cap line" sits below the top of its em box (unlike
// the Latin vector font, which is cap-height = 1 with no descender space
// reserved) -- matches kundliOverlay.ts's devanagariLabelMarkup baseline.
const BASELINE_FRACTION = 0.72;
const MAX_SUMMARY_LINES = 8;

export const PANCHANG_FACTS_COLOR = "#fdf6e6";
export const PANCHANG_SUMMARY_COLOR = "#e8c98a";

export function devanagariMarkup(shaped: ShapedText, x: number, y: number, size: number, color: string, align: "left" | "center" = "left"): string {
  const left = align === "center" ? x - (shaped.width * size) / 2 : x;
  const baseline = y + size * BASELINE_FRACTION;
  return `<path d="${shaped.d}" fill="${color}" transform="translate(${left.toFixed(1)} ${baseline.toFixed(1)}) scale(${size.toFixed(2)})" />`;
}

/** "तिथि: दशमी, नक्षत्र: श्रवण, योग: धृति", shaped -- or null without Panchang data. */
export async function shapePanchangFacts(panchang: DailyReading["panchang"]): Promise<ShapedText | null> {
  if (!panchang) return null;
  const { tithi, nakshatra, yoga } = panchang.data;
  return shapeDevanagariText(`तिथि: ${tithi.name}, नक्षत्र: ${nakshatra.name}, योग: ${yoga.name}`);
}

/** The summary wrapped to `maxWidth` at `fontSize` (capped), or [] when there's none. */
export async function shapePanchangSummary(panchang: DailyReading["panchang"], maxWidth: number, fontSize: number): Promise<ShapedText[]> {
  const summary = panchang?.insight?.summary;
  if (!summary) return [];
  return (await shapeDevanagariLines(summary, maxWidth, fontSize)).slice(0, MAX_SUMMARY_LINES);
}
