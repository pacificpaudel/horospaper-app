import type { DailyReading } from "@/lib/dailyReading";
import { kundliRect } from "./kundliOverlay";
import { shapeDevanagariLines, shapeDevanagariText } from "./devanagariShaper";

// The day's Panchang, drawn as an opaque panel beside the kundli (see
// kundliOverlay.ts's kundliRect -- both panels share the same bottom edge,
// right above the luck meter, so this one can never drift out of vertical
// alignment with the kundli even though it's sized to its own, taller,
// content). Facts (tithi/nakshatra/yoga, in Devanagari --
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
 * narrow desktop ratio. Its bottom edge lines up with the kundli's bottom
 * (both sit right above the luck meter), but it's sized to its own
 * content -- at this font size, that's taller than the kundli -- so it
 * grows upward rather than cramming or clipping its text. Async: shaping
 * Devanagari text needs the font loaded and each line actually shaped
 * (see devanagariShaper.ts).
 */
export async function buildPanchangMarkup(width: number, height: number, panchang: DailyReading["panchang"]): Promise<string> {
  if (!panchang) return "";

  const { x0: kundliX, y0: kundliY0, size: kundliSize, gap } = kundliRect(width, height);
  const cornerSize = cornerDiagramSize(width, height);
  const panelX = kundliX + kundliSize + gap;
  // Stays clear of the bottom-right corner planet diagram, which the panel
  // can vertically overlap depending on canvas proportions.
  const rightLimit = width - cornerSize - gap;
  const panelWidth = rightLimit - panelX;
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

  // Doubled from the original size -- see kundliRect's height for scale;
  // the panel below grows to fit this rather than shrinking it back down.
  const headingSize = kundliSize * 0.124;
  const factSize = kundliSize * 0.104;
  const summarySize = kundliSize * 0.092;
  const topPad = headingSize * 0.85;
  const factRowHeight = factSize * 1.8;
  const summaryLineHeight = summarySize * 1.55;
  const bottomPad = summarySize * 0.6;

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

  // Bottom-anchored to the same line the kundli ends on; the panel isn't
  // allowed to grow past this ceiling (clear of the date header above), so
  // the summary is truncated to whatever line count actually fits rather
  // than letting text render past the box.
  const bottomY = kundliY0 + kundliSize;
  const topLimit = Math.round(height * 0.22);
  const maxAvailableHeight = bottomY - topLimit;

  // The height budget (via topLimit above) is already the real ceiling on
  // how tall this can grow -- no extra hard line cap, since a narrower
  // panel (e.g. mobile/frame) naturally wraps the same sentence into more,
  // shorter lines and still needs to fit all of them.
  const preSummaryHeight = topPad + headingSize * 1.9 + factRowHeight * 3;
  const summaryBudget = Math.max(0, maxAvailableHeight - preSummaryHeight - bottomPad - factSize * 0.6);
  const maxSummaryLines = Math.floor(summaryBudget / summaryLineHeight);

  const summary = panchang.insight?.summary;
  const summaryLines = summary && maxSummaryLines > 0 ? (await shapeDevanagariLines(summary, innerWidth, summarySize)).slice(0, maxSummaryLines) : [];

  const panelHeight = preSummaryHeight + (summaryLines.length ? factSize * 0.6 + summaryLines.length * summaryLineHeight : 0) + bottomPad;
  const panelY = bottomY - panelHeight;

  let cursorY = panelY + topPad;
  const parts: string[] = [devanagariMarkup(heading, centerX, cursorY, headingSize, headingColor, "center")];
  cursorY += headingSize * 1.9;

  for (const [label, value] of [
    [tithiLabel, tithiValue],
    [nakshatraLabel, nakshatraValue],
    [yogaLabel, yogaValue],
  ] as const) {
    parts.push(devanagariMarkup(label, leftX, cursorY, factSize, labelColor));
    parts.push(devanagariMarkup(value, leftX + label.width * factSize + factSize * 0.35, cursorY, factSize, valueColor));
    cursorY += factRowHeight;
  }

  if (summaryLines.length) {
    cursorY += factSize * 0.6;
    for (const line of summaryLines) {
      parts.push(devanagariMarkup(line, centerX, cursorY, summarySize, summaryColor, "center"));
      cursorY += summaryLineHeight;
    }
  }

  return `
  <g>
    <rect x="${panelX.toFixed(1)}" y="${(panelY - stroke).toFixed(1)}" width="${panelWidth.toFixed(1)}" height="${(panelHeight + stroke * 2).toFixed(1)}" rx="${(kundliSize * 0.02).toFixed(1)}" fill="#080b16" />
    <rect x="${panelX.toFixed(1)}" y="${panelY.toFixed(1)}" width="${panelWidth.toFixed(1)}" height="${panelHeight.toFixed(1)}" fill="none" stroke="#f7c56a" stroke-opacity="0.55" stroke-width="${stroke.toFixed(1)}" />
    ${parts.join("")}
  </g>`;
}
