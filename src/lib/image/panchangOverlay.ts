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
export async function buildPanchangMarkup(
  width: number,
  height: number,
  panchang: DailyReading["panchang"],
  /** Lowest y the panel may grow up to, e.g. below the Schumann graph (schumannOverlay.ts). */
  ceiling = 0
): Promise<string> {
  if (!panchang) return "";

  const { x0: kundliX, y0: kundliY0, size: kundliSize, gap, top: kundliTop } = kundliRect(width, height);
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

  // Bottom-anchored to the same line the kundli ends on, holding just the
  // heading and the 3 facts. The LLM's summary sentence runs as its own
  // wide, horizontal strip above this row instead (see below), so it reads
  // as one or two long lines rather than a narrow wrapped column.
  const bottomY = kundliY0 + kundliSize;
  const panelHeight = topPad + headingSize * 1.9 + factRowHeight * 3 + bottomPad;
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

  const summaryStrip = await summaryStripMarkup({
    summary: panchang.insight?.summary,
    width,
    height,
    rowTop: Math.min(kundliTop, panelY - stroke),
    gap,
    ceiling,
    size: summarySize,
    lineHeight: summaryLineHeight,
    stroke,
    radius: kundliSize * 0.02,
    color: summaryColor,
  });

  return `
  <g>
    <rect x="${panelX.toFixed(1)}" y="${(panelY - stroke).toFixed(1)}" width="${panelWidth.toFixed(1)}" height="${(panelHeight + stroke * 2).toFixed(1)}" rx="${(kundliSize * 0.02).toFixed(1)}" fill="#080b16" />
    <rect x="${panelX.toFixed(1)}" y="${panelY.toFixed(1)}" width="${panelWidth.toFixed(1)}" height="${panelHeight.toFixed(1)}" fill="none" stroke="#f7c56a" stroke-opacity="0.55" stroke-width="${stroke.toFixed(1)}" />
    ${parts.join("")}
    ${summaryStrip}
  </g>`;
}

/**
 * The day's Panchang summary as a wide strip centered above the kundli +
 * Panchang row: as many full-width lines as fit between `ceiling` (or the
 * date header area, at minimum) and that row, or "" if none do.
 */
async function summaryStripMarkup(opts: {
  summary: string | undefined;
  width: number;
  height: number;
  rowTop: number;
  gap: number;
  ceiling: number;
  size: number;
  lineHeight: number;
  stroke: number;
  radius: number;
  color: string;
}): Promise<string> {
  const { summary, width, height, rowTop, gap, size, lineHeight, stroke } = opts;
  if (!summary) return "";
  const stripWidth = Math.min(width * 0.92, Math.min(width, height) * 1.5);
  const padX = size * 1.1;
  const padY = size * 0.55;
  const bottom = rowTop - gap;
  const topLimit = Math.max(Math.round(height * 0.22), Math.round(opts.ceiling));
  // n lines take padY * 2 + n * lineHeight - (lineHeight - size).
  const maxLines = Math.floor((bottom - topLimit - padY * 2 + (lineHeight - size)) / lineHeight);
  if (maxLines < 1) return "";

  const lines = (await shapeDevanagariLines(summary, stripWidth - padX * 2, size)).slice(0, maxLines);
  if (!lines.length) return "";
  const stripHeight = padY * 2 + lines.length * lineHeight - (lineHeight - size);
  const top = bottom - stripHeight;
  const x = (width - stripWidth) / 2;
  const centerX = width / 2;
  const text = lines.map((line, i) => devanagariMarkup(line, centerX, top + padY + i * lineHeight, size, opts.color, "center")).join("");
  return `
    <rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${stripWidth.toFixed(1)}" height="${stripHeight.toFixed(1)}" rx="${opts.radius.toFixed(1)}" fill="#080b16" fill-opacity="0.82" stroke="#f7c56a" stroke-opacity="0.55" stroke-width="${stroke.toFixed(1)}" />
    ${text}`;
}
