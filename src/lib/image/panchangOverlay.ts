import type { DailyReading } from "@/lib/dailyReading";
import { kundliRect } from "./kundliOverlay";
import { shapeDevanagariLines, shapeDevanagariText } from "./devanagariShaper";

// The day's Panchang, drawn as an opaque panel beside the kundli (see
// kundliOverlay.ts's kundliRect -- both panels share the same top edge and
// height, and this one reuses the kundli's exact box so it can never drift
// out of alignment with it). Facts (tithi/nakshatra/yoga, in Devanagari --
// see panchang.ts's language: "hi") come straight from freeastroapi.com;
// the summary sentence, also in Nepali, is the LLM's interpretation of
// those exact facts (see panchangInsight.ts) -- shown only when that
// interpretation succeeded, never fabricated here. Every label is real
// HarfBuzz-shaped Devanagari (devanagariShaper.ts), not the Latin-only
// hand-built vector font the rest of the wallpaper uses, so conjuncts and
// matras render cleanly instead of as separate, misplaced marks.

const CORNER_DIAGRAM_MAX = 190;
const CORNER_DIAGRAM_MIN = 100;
// Devanagari's visual "cap line" sits below the top of its em box (unlike
// the Latin vector font, which is cap-height = 1 with no descender space
// reserved) -- matches kundliOverlay.ts's devanagariLabelMarkup baseline.
const BASELINE_FRACTION = 0.72;

function cornerDiagramSize(width: number, height: number): number {
  return Math.max(CORNER_DIAGRAM_MIN, Math.min(CORNER_DIAGRAM_MAX, Math.round(Math.min(width, height) * 0.17)));
}

function devanagariMarkup(shaped: { d: string; width: number }, x: number, y: number, size: number, color: string, align: "left" | "center" = "left"): string {
  const left = align === "center" ? x - (shaped.width * size) / 2 : x;
  const baseline = y + size * BASELINE_FRACTION;
  return `<path d="${shaped.d}" fill="${color}" transform="translate(${left.toFixed(1)} ${baseline.toFixed(1)}) scale(${size.toFixed(2)})" />`;
}

/**
 * Returns the Panchang panel as SVG markup, or "" when there's no Panchang
 * data (no key configured, quota spent, or the service was unreachable)
 * or the panel would have too little width to be legible -- e.g. a very
 * narrow desktop ratio. Placed to the right of the kundli, matching its
 * top edge and height. Async: shaping Devanagari text needs the font
 * loaded and each line actually shaped (see devanagariShaper.ts).
 */
export async function buildPanchangMarkup(width: number, height: number, panchang: DailyReading["panchang"]): Promise<string> {
  if (!panchang) return "";

  const { x0: kundliX, y0, size: kundliSize, gap } = kundliRect(width, height);
  const cornerSize = cornerDiagramSize(width, height);
  const panelX = kundliX + kundliSize + gap;
  // Stays clear of the bottom-right corner planet diagram, which the panel
  // can vertically overlap depending on canvas proportions.
  const rightLimit = width - cornerSize - gap;
  const panelWidth = rightLimit - panelX;
  const panelHeight = kundliSize;
  // Too narrow to hold even a couple of label:value lines legibly -- skip
  // rather than draw a cramped, overlapping panel (e.g. a near-square
  // desktop ratio with little room beside the kundli).
  if (panelWidth < kundliSize * 0.55) return "";

  const stroke = Math.max(1.2, kundliSize * 0.006);
  const padX = panelWidth * 0.08;
  const innerWidth = panelWidth - padX * 2;
  const centerX = panelX + panelWidth / 2;
  const leftX = centerX - innerWidth / 2;

  const headingColor = "#f7c56a";
  const labelColor = "#9aa6c8";
  const valueColor = "#fdf6e6";
  const summaryColor = "#e8c98a";

  const headingSize = kundliSize * 0.062;
  const factSize = kundliSize * 0.052;

  const { data } = panchang;
  const [heading, ...facts] = await Promise.all([
    shapeDevanagariText("पञ्चांग"),
    shapeDevanagariText("तिथि:"),
    shapeDevanagariText(data.tithi.name),
    shapeDevanagariText("नक्षत्र:"),
    shapeDevanagariText(data.nakshatra.name),
    shapeDevanagariText("योग:"),
    shapeDevanagariText(data.yoga.name),
  ]);
  const [tithiLabel, tithiValue, nakshatraLabel, nakshatraValue, yogaLabel, yogaValue] = facts;

  let cursorY = y0 + headingSize * 0.85;
  const parts: string[] = [devanagariMarkup(heading, centerX, cursorY, headingSize, headingColor, "center")];
  cursorY += headingSize * 1.9;

  for (const [label, value] of [
    [tithiLabel, tithiValue],
    [nakshatraLabel, nakshatraValue],
    [yogaLabel, yogaValue],
  ] as const) {
    parts.push(devanagariMarkup(label, leftX, cursorY, factSize, labelColor));
    parts.push(devanagariMarkup(value, leftX + label.width * factSize + factSize * 0.35, cursorY, factSize, valueColor));
    cursorY += factSize * 1.8;
  }

  const summary = panchang.insight?.summary;
  if (summary) {
    cursorY += factSize * 0.6;
    const summarySize = kundliSize * 0.046;
    const lineHeight = summarySize * 1.55;
    const maxLines = Math.max(1, Math.floor((y0 + panelHeight - cursorY) / lineHeight));
    const lines = (await shapeDevanagariLines(summary, innerWidth, summarySize)).slice(0, maxLines);
    for (const line of lines) {
      parts.push(devanagariMarkup(line, centerX, cursorY, summarySize, summaryColor, "center"));
      cursorY += lineHeight;
    }
  }

  return `
  <g>
    <rect x="${panelX.toFixed(1)}" y="${(y0 - stroke).toFixed(1)}" width="${panelWidth.toFixed(1)}" height="${(panelHeight + stroke * 2).toFixed(1)}" rx="${(kundliSize * 0.02).toFixed(1)}" fill="#080b16" />
    <rect x="${panelX.toFixed(1)}" y="${y0.toFixed(1)}" width="${panelWidth.toFixed(1)}" height="${panelHeight.toFixed(1)}" fill="none" stroke="#f7c56a" stroke-opacity="0.55" stroke-width="${stroke.toFixed(1)}" />
    ${parts.join("")}
  </g>`;
}
