import type { DailyReading } from "@/lib/dailyReading";
import { kundliRect } from "./kundliOverlay";
import { buildCenteredVectorTextMarkup, buildVectorTextMarkup, measureVectorText, TextStyle, wrapVectorText } from "./vectorFont";

// The day's Panchang, drawn as an opaque panel beside the kundli (see
// kundliOverlay.ts's kundliRect -- both panels share the same top edge and
// height, and this one reuses the kundli's exact box so it can never drift
// out of alignment with it). Facts (tithi/nakshatra/yoga) come straight
// from freeastroapi.com; the summary sentence is the LLM's interpretation
// of those exact facts (see panchangInsight.ts) -- shown only when that
// interpretation succeeded, never fabricated here.

const CORNER_DIAGRAM_MAX = 190;
const CORNER_DIAGRAM_MIN = 100;

function cornerDiagramSize(width: number, height: number): number {
  return Math.max(CORNER_DIAGRAM_MIN, Math.min(CORNER_DIAGRAM_MAX, Math.round(Math.min(width, height) * 0.17)));
}

/**
 * Returns the Panchang panel as SVG markup, or "" when there's no Panchang
 * data (no key configured, quota spent, or the service was unreachable)
 * or the panel would have too little width to be legible -- e.g. a very
 * narrow desktop ratio. Placed to the right of the kundli, matching its
 * top edge and height.
 */
export function buildPanchangMarkup(width: number, height: number, panchang: DailyReading["panchang"]): string {
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

  const headingStyle: TextStyle = { color: "#f7c56a", strokeWidth: 0.13, tracking: 0.22 };
  const labelStyle: TextStyle = { color: "#9aa6c8", strokeWidth: 0.11, tracking: 0.1 };
  const valueStyle: TextStyle = { color: "#fdf6e6", strokeWidth: 0.12, tracking: 0.06 };
  const summaryStyle: TextStyle = { color: "#e8c98a", strokeWidth: 0.1, tracking: 0.05 };

  const headingSize = kundliSize * 0.058;
  const factSize = kundliSize * 0.05;
  let cursorY = y0 + headingSize * 0.9;
  const parts: string[] = [
    buildCenteredVectorTextMarkup("PANCHANG", centerX, cursorY, headingSize, headingStyle),
  ];
  cursorY += headingSize * 1.9;

  const { data } = panchang;
  const facts: [string, string][] = [
    ["TITHI", data.tithi.name.toUpperCase()],
    ["NAKSHATRA", data.nakshatra.name.toUpperCase()],
    ["YOGA", data.yoga.name.toUpperCase()],
  ];
  for (const [label, value] of facts) {
    const labelText = `${label}:`;
    const labelWidth = measureVectorText(labelText, factSize, labelStyle);
    const x = centerX - innerWidth / 2;
    parts.push(buildVectorTextMarkup(labelText, x, cursorY, factSize, labelStyle));
    parts.push(buildVectorTextMarkup(value, x + labelWidth + factSize * 0.35, cursorY, factSize, valueStyle));
    cursorY += factSize * 1.7;
  }

  const summary = panchang.insight?.summary;
  if (summary) {
    cursorY += factSize * 0.6;
    const summarySize = kundliSize * 0.044;
    const lineHeight = summarySize * 1.5;
    const maxLines = Math.max(1, Math.floor((y0 + panelHeight - cursorY) / lineHeight));
    const lines = wrapVectorText(summary.toUpperCase(), innerWidth, summarySize, summaryStyle).slice(0, maxLines);
    for (const line of lines) {
      parts.push(buildCenteredVectorTextMarkup(line, centerX, cursorY, summarySize, summaryStyle));
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
