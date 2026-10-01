import { getTimezoneOffset } from "date-fns-tz";
import { schumannLevel, SchumannGraph, SchumannSnapshot, TOMSK_UTC_OFFSET_HOURS } from "@/lib/schumann";
import { buildCenteredVectorTextMarkup, buildVectorTextMarkup, measureVectorText, TextStyle } from "./vectorFont";

// schumannresonance.today's circular "calmness" gauge and its live Tomsk
// spectrogram. The gauge is a vector copy of the site's own EnergyGauge
// component (same 260-unit geometry, colors and thresholds), with no
// backdrop so the photo shows through. The spectrogram is the site's live
// image cropped to its plot, with the wallpaper's own axis labels drawn
// around it -- in the viewer's local time rather than the station's, plus
// a red line at the current time. The source's own labels are ~11px tall
// and would be unreadable once scaled onto a wallpaper. All text uses the
// vector font, never <text> (sharp's rasterizer has no fonts in
// production -- see vectorFont.ts). Where each part goes is decided by
// wallpaperLayout.ts.

const PLOT_HOURS = 72;
const PLOT_MAX_HZ = 40;
const HOUR_MS = 3600_000;
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// The gauge's colors, as hex conversions of the site's hsl() values.
const TRACK_COLOR = "#1b1f32"; // hsl(230, 30%, 15%)
const DIM_DOT_COLOR = "#2d3353"; // hsl(230, 30%, 25%)
const MUTED_COLOR = "#a3acc6";
const NOW_COLOR = "#ff4d4d";

/** This hour's snapshot, plus who it's drawn for: their time zone and the render time. */
export interface SchumannView {
  snapshot: SchumannSnapshot;
  /** IANA zone the graph's axes are labelled in. */
  timeZone: string;
  now: Date;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function levelColor(score: number): string {
  if (score <= 25) return "#30abe8"; // hsl(200, 80%, 55%)
  if (score <= 50) return "#ffc61a"; // hsl(45, 100%, 55%)
  if (score <= 75) return "#ff3d3d"; // hsl(0, 100%, 62%)
  return "#ff3dff"; // hsl(300, 100%, 62%)
}

export interface GraphChrome {
  padX: number;
  padTop: number;
  titleSize: number;
  titleRow: number;
  dateRow: number;
  hourRow: number;
  padBottom: number;
  axisW: number;
}

/** Fixed space around the plot, for label size `l`. Uncropped graphs carry their own axes. */
export function graphChrome(l: number, cropped: boolean): GraphChrome {
  const titleSize = l * 1.05;
  return {
    padX: l * 0.8,
    padTop: l * 0.7,
    titleSize,
    titleRow: titleSize * 1.7,
    dateRow: cropped ? l * 1.6 : 0,
    hourRow: cropped ? l * 1.9 : 0,
    padBottom: l * 0.5,
    axisW: cropped ? l * 2.5 : 0,
  };
}

export const chromeHeight = (c: GraphChrome) => c.padTop + c.titleRow + c.dateRow + c.hourRow + c.padBottom;
export const chromeWidth = (c: GraphChrome) => c.padX * 2 + c.axisW;

/** The graph's base label size for a panel `boxWidth` wide. */
export function graphLabelSize(boxWidth: number): number {
  return Math.max(9, boxWidth * 0.028);
}

/** Panel height for a graph `boxWidth` wide: its labels plus a 2:1 plot (the source's own ratio if uncropped). */
export function graphHeightFor(boxWidth: number, graph: SchumannGraph): number {
  const c = graphChrome(graphLabelSize(boxWidth), graph.cropped);
  return chromeHeight(c) + (boxWidth - chromeWidth(c)) / (graph.cropped ? 2 : graph.width / graph.height);
}

export function buildGaugeMarkup(cx: number, cy: number, d: number, score: number): string {
  const s = d / 260;
  const color = levelColor(score);
  const r = 120 * s;
  const circumference = 2 * Math.PI * r;
  const filled = (circumference * score) / 100;
  const stroke = 12 * s;

  const dots = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 * Math.PI) / 180;
    const fill = i * 8.33 <= score ? color : DIM_DOT_COLOR;
    return `<circle cx="${(cx + 100 * s * Math.cos(angle)).toFixed(1)}" cy="${(cy + 100 * s * Math.sin(angle)).toFixed(1)}" r="${(2.5 * s).toFixed(1)}" fill="${fill}" />`;
  }).join("");
  const arc = (extra: string) =>
    `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${stroke.toFixed(1)}" stroke-linecap="round" stroke-dasharray="${filled.toFixed(1)} ${circumference.toFixed(1)}" ${extra} />`;

  const numberText = String(score);
  const numberSize = d * 0.28;
  const levelText = schumannLevel(score).toUpperCase();
  const levelSize = d * 0.065;
  const contentHeight = numberSize + levelSize * 0.9 + levelSize;
  const numberTop = cy - contentHeight / 2;
  const levelTop = numberTop + numberSize + levelSize * 0.9;
  const numberStyle: TextStyle = { color, strokeWidth: 0.21, tracking: 0.1 };

  return `
  <g>
    <defs>
      <radialGradient id="srGaugeGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.2" />
        <stop offset="70%" stop-color="${color}" stop-opacity="0" />
      </radialGradient>
      <filter id="srGaugeBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(5 * s).toFixed(1)}" /></filter>
    </defs>
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(130 * s).toFixed(1)}" fill="url(#srGaugeGlow)" />
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${TRACK_COLOR}" stroke-opacity="0.85" stroke-width="${stroke.toFixed(1)}" />
    <g transform="rotate(-90 ${cx.toFixed(1)} ${cy.toFixed(1)})">
      ${score > 0 ? arc(`filter="url(#srGaugeBlur)" opacity="0.85"`) + arc("") : ""}
      ${dots}
    </g>
    <g filter="url(#srGaugeBlur)" opacity="0.8">${buildCenteredVectorTextMarkup(numberText, cx, numberTop, numberSize, numberStyle)}</g>
    ${buildCenteredVectorTextMarkup(numberText, cx, numberTop, numberSize, numberStyle)}
    ${buildCenteredVectorTextMarkup(levelText, cx, levelTop, levelSize, { color: MUTED_COLOR, strokeWidth: 0.16, tracking: 0.3 })}
  </g>`;
}

/** UTC offset of `timeZone` at `ms`, in ms; 0 for an unknown zone. */
function offsetMs(timeZone: string, ms: number): number {
  const offset = getTimezoneOffset(timeZone, new Date(ms));
  return Number.isFinite(offset) ? offset : 0;
}

/** Wall-clock fields of instant `ms` in `timeZone`. */
function localParts(timeZone: string, ms: number): Date {
  return new Date(ms + offsetMs(timeZone, ms));
}

function formatOffset(offset: number): string {
  const sign = offset < 0 ? "-" : "+";
  const minutes = Math.round(Math.abs(offset) / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

const clock = (local: Date) => `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;

export function buildGraphMarkup(box: Box, graph: SchumannGraph, l: number, view: SchumannView): string {
  const { timeZone } = view;
  const c = graphChrome(l, graph.cropped);
  const plot: Box = {
    x: box.x + c.padX + c.axisW,
    y: box.y + c.padTop + c.titleRow + c.dateRow,
    w: box.w - chromeWidth(c),
    h: box.h - chromeHeight(c),
  };
  const titleStyle: TextStyle = { color: "#f7c56a", strokeWidth: 0.11, tracking: 0.14 };
  const infoStyle: TextStyle = { color: MUTED_COLOR, strokeWidth: 0.1, tracking: 0.1 };
  const labelStyle: TextStyle = { color: "#dfe6f5", strokeWidth: 0.1, tracking: 0.08 };
  const dateStyle: TextStyle = { color: "#fdf6e6", strokeWidth: 0.11, tracking: 0.12 };
  const parts: string[] = [];

  parts.push(
    `<rect x="${box.x.toFixed(1)}" y="${box.y.toFixed(1)}" width="${box.w.toFixed(1)}" height="${box.h.toFixed(1)}" rx="${(l * 0.7).toFixed(1)}" fill="#0b1220" fill-opacity="0.6" />`
  );

  // Title on the left; the local zone the axis is in and when the chart
  // was last updated on the right, shortened or dropped if the row is too
  // narrow for both.
  const title = "SCHUMANN RESONANCE LIVE";
  const titleWidth = measureVectorText(title, c.titleSize, titleStyle);
  parts.push(buildVectorTextMarkup(title, box.x + c.padX, box.y + c.padTop, c.titleSize, titleStyle));
  const roomForInfo = box.w - c.padX * 2 - titleWidth - l * 1.5;
  const infoSize = l * 0.85;
  const updated = clock(localParts(timeZone, graph.updatedAt.getTime()));
  const zone = formatOffset(offsetMs(timeZone, graph.updatedAt.getTime()));
  const info = [`LOCAL ${zone} · UPDATED ${updated}`, `UPDATED ${updated}`].find((text) => measureVectorText(text, infoSize, infoStyle) <= roomForInfo);
  if (info) {
    const infoWidth = measureVectorText(info, infoSize, infoStyle);
    parts.push(buildVectorTextMarkup(info, box.x + box.w - c.padX - infoWidth, box.y + c.padTop + (c.titleSize - infoSize) / 2, infoSize, infoStyle));
  }

  const image = `data:image/jpeg;base64,${graph.jpeg.toString("base64")}`;
  if (!graph.cropped) {
    parts.push(
      `<image x="${plot.x.toFixed(1)}" y="${plot.y.toFixed(1)}" width="${plot.w.toFixed(1)}" height="${plot.h.toFixed(1)}" preserveAspectRatio="xMidYMid meet" href="${image}" />`
    );
    return `<g>${parts.join("")}</g>`;
  }

  parts.push(
    `<image x="${plot.x.toFixed(1)}" y="${plot.y.toFixed(1)}" width="${plot.w.toFixed(1)}" height="${plot.h.toFixed(1)}" preserveAspectRatio="none" href="${image}" />`,
    `<rect x="${plot.x.toFixed(1)}" y="${plot.y.toFixed(1)}" width="${plot.w.toFixed(1)}" height="${plot.h.toFixed(1)}" fill="none" stroke="${MUTED_COLOR}" stroke-opacity="0.6" stroke-width="${(l * 0.07).toFixed(1)}" />`
  );

  // The plot covers 72 hours from Tomsk midnight, 2 days before its newest
  // day. Everything below positions by instant, labelled in local time.
  const [year, month, day] = graph.lastDay.split("-").map(Number);
  const startMs = Date.UTC(year, month - 1, day - 2) - TOMSK_UTC_OFFSET_HOURS * HOUR_MS;
  const endMs = startMs + PLOT_HOURS * HOUR_MS;
  const xAt = (ms: number) => plot.x + ((ms - startMs) / (endMs - startMs)) * plot.w;

  // Every whole local hour inside the plot.
  const hours: { ms: number; hour: number }[] = [];
  const firstLocal = Math.ceil((startMs + offsetMs(timeZone, startMs)) / HOUR_MS) * HOUR_MS;
  for (let ms = firstLocal - offsetMs(timeZone, startMs); ms <= endMs; ms += HOUR_MS) {
    hours.push({ ms, hour: localParts(timeZone, ms).getUTCHours() });
  }

  // Local midnights split the plot into days: a dashed line at each, and
  // each day's date centered over its stretch (skipped if too short for it).
  const dateSize = l;
  const dateTop = plot.y - c.dateRow + (c.dateRow - dateSize) / 2 - l * 0.1;
  const midnights = hours.filter((h) => h.hour === 0).map((h) => h.ms);
  const bounds = [startMs, ...midnights.filter((ms) => ms > startMs && ms < endMs), endMs];
  for (let i = 0; i < bounds.length - 1; i++) {
    const segmentWidth = xAt(bounds[i + 1]) - xAt(bounds[i]);
    const local = localParts(timeZone, (bounds[i] + bounds[i + 1]) / 2);
    const full = `${WEEKDAYS[local.getUTCDay()]} ${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]}`;
    const short = `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]}`;
    const label = [full, short].find((text) => measureVectorText(text, dateSize, dateStyle) <= segmentWidth * 0.92);
    if (label) parts.push(buildCenteredVectorTextMarkup(label, (xAt(bounds[i]) + xAt(bounds[i + 1])) / 2, dateTop, dateSize, dateStyle));
    if (i > 0) {
      const x = xAt(bounds[i]).toFixed(1);
      parts.push(
        `<line x1="${x}" y1="${(plot.y - c.dateRow * 0.25).toFixed(1)}" x2="${x}" y2="${(plot.y + plot.h).toFixed(1)}" stroke="#ffffff" stroke-opacity="0.6" stroke-width="${(l * 0.08).toFixed(1)}" stroke-dasharray="${(l * 0.3).toFixed(1)} ${(l * 0.25).toFixed(1)}" />`
      );
    }
  }

  // Frequency axis (0 Hz at the top, as in the source chart), at the
  // densest step its labels have room for.
  const axisSize = l * 0.85;
  const hzStep = [8, 20, 40].find((step) => (plot.h * step) / PLOT_MAX_HZ >= axisSize * 1.6) ?? PLOT_MAX_HZ;
  const axisRight = plot.x - l * 0.45;
  for (let hz = 0; hz <= PLOT_MAX_HZ; hz += hzStep) {
    const y = plot.y + (hz / PLOT_MAX_HZ) * plot.h;
    const text = String(hz);
    parts.push(buildVectorTextMarkup(text, axisRight - measureVectorText(text, axisSize, labelStyle), y - axisSize / 2, axisSize, labelStyle));
    parts.push(
      `<line x1="${(plot.x - l * 0.25).toFixed(1)}" y1="${y.toFixed(1)}" x2="${plot.x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${MUTED_COLOR}" stroke-width="${(l * 0.07).toFixed(1)}" />`
    );
  }
  const hzUnit = "HZ";
  parts.push(buildVectorTextMarkup(hzUnit, axisRight - measureVectorText(hzUnit, axisSize, infoStyle), dateTop, axisSize, infoStyle));

  // Local-hour axis, every 3/6/12 hours depending on how much room each label has.
  const hourStep = [3, 6, 12].find((step) => (plot.w * step) / PLOT_HOURS >= measureVectorText("18", axisSize, labelStyle) * 2.2) ?? 24;
  for (const { ms, hour } of hours) {
    if (hour % hourStep !== 0) continue;
    const x = xAt(ms);
    parts.push(
      `<line x1="${x.toFixed(1)}" y1="${(plot.y + plot.h).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(plot.y + plot.h + l * 0.35).toFixed(1)}" stroke="${MUTED_COLOR}" stroke-width="${(l * 0.07).toFixed(1)}" />`
    );
    parts.push(buildCenteredVectorTextMarkup(String(hour), x, plot.y + plot.h + l * 0.6, axisSize, labelStyle));
  }

  // The current time, as a red line with a small marker on top.
  const nowMs = view.now.getTime();
  if (nowMs >= startMs && nowMs <= endMs) {
    const x = xAt(nowMs);
    const mark = l * 0.4;
    parts.push(
      `<line x1="${x.toFixed(1)}" y1="${plot.y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(plot.y + plot.h).toFixed(1)}" stroke="${NOW_COLOR}" stroke-width="${(l * 0.14).toFixed(1)}" />`,
      `<path d="M${(x - mark).toFixed(1)} ${(plot.y - mark * 1.2).toFixed(1)} L${(x + mark).toFixed(1)} ${(plot.y - mark * 1.2).toFixed(1)} L${x.toFixed(1)} ${plot.y.toFixed(1)} Z" fill="${NOW_COLOR}" />`
    );
  }

  return `<g>${parts.join("")}</g>`;
}
