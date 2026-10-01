import { schumannLevel, SchumannGraph, SchumannSnapshot, TOMSK_UTC_OFFSET_HOURS } from "@/lib/schumann";
import { kundliRect } from "./kundliOverlay";
import { buildCenteredVectorTextMarkup, buildVectorTextMarkup, measureVectorText, TextStyle } from "./vectorFont";

// schumannresonance.today's circular "calmness" gauge and its live Tomsk
// spectrogram, drawn just below the date header's 2 tags. The gauge is a
// vector copy of the site's own EnergyGauge component (same 260-unit
// geometry, colors and thresholds), with no backdrop so the photo shows
// through. The spectrogram is the site's live image cropped to its plot,
// with the wallpaper's own large axis labels drawn around it -- the
// source's labels are ~11px tall and would be unreadable once scaled
// onto a wallpaper. All text uses the vector font, never <text> (sharp's
// rasterizer has no fonts in production -- see vectorFont.ts).
//
// Portrait canvases (mobile/frame) stack the graph below the gauge; on a
// landscape desktop canvas there isn't the height for that above the
// kundli, so the two sit side by side as one centered row instead.

const PLOT_HOURS = 72;
const PLOT_MAX_HZ = 40;
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// The gauge's colors, as hex conversions of the site's hsl() values.
const TRACK_COLOR = "#1b1f32"; // hsl(230, 30%, 15%)
const DIM_DOT_COLOR = "#2d3353"; // hsl(230, 30%, 25%)
const MUTED_COLOR = "#a3acc6";

function levelColor(score: number): string {
  if (score <= 25) return "#30abe8"; // hsl(200, 80%, 55%)
  if (score <= 50) return "#ffc61a"; // hsl(45, 100%, 55%)
  if (score <= 75) return "#ff3d3d"; // hsl(0, 100%, 62%)
  return "#ff3dff"; // hsl(300, 100%, 62%)
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface GraphChrome {
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
function graphChrome(l: number, cropped: boolean): GraphChrome {
  const titleSize = l * 1.05;
  return {
    padX: l * 0.9,
    padTop: l * 0.75,
    titleSize,
    titleRow: titleSize * 1.8,
    dateRow: cropped ? l * 1.7 : 0,
    hourRow: cropped ? l * 2.0 : 0,
    padBottom: l * 0.6,
    axisW: cropped ? l * 2.6 : 0,
  };
}

const chromeHeight = (c: GraphChrome) => c.padTop + c.titleRow + c.dateRow + c.hourRow + c.padBottom;
const chromeWidth = (c: GraphChrome) => c.padX * 2 + c.axisW;

function gaugeMarkup(cx: number, cy: number, d: number, score: number): string {
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
  const numberSize = d * 0.17;
  const levelText = schumannLevel(score).toUpperCase();
  const levelSize = d * 0.055;
  const contentHeight = numberSize + levelSize * 0.9 + levelSize;
  const numberTop = cy - contentHeight / 2;
  const levelTop = numberTop + numberSize + levelSize * 0.9;
  const numberStyle: TextStyle = { color, strokeWidth: 0.13, tracking: 0.08 };

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
    ${buildCenteredVectorTextMarkup(levelText, cx, levelTop, levelSize, { color: MUTED_COLOR, strokeWidth: 0.12, tracking: 0.3 })}
  </g>`;
}

function dayLabel(isoDay: string, maxWidth: number, size: number, style: TextStyle): string {
  const [year, month, day] = isoDay.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const full = `${WEEKDAYS[date.getUTCDay()]} ${day} ${MONTHS[month - 1]}`;
  return measureVectorText(full, size, style) <= maxWidth ? full : `${day} ${MONTHS[month - 1]}`;
}

function shiftDay(isoDay: string, days: number): string {
  const [year, month, day] = isoDay.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days, 12)).toISOString().slice(0, 10);
}

function tomskClock(instant: Date): string {
  const shifted = new Date(instant.getTime() + TOMSK_UTC_OFFSET_HOURS * 3600_000);
  return `${String(shifted.getUTCHours()).padStart(2, "0")}:${String(shifted.getUTCMinutes()).padStart(2, "0")}`;
}

function graphMarkup(box: Box, graph: SchumannGraph, l: number): string {
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

  // Title on the left; the station, its time zone (which the hour axis
  // is in) and when the chart was last updated on the right, shortened or
  // dropped if the row is too narrow for both.
  const title = "SCHUMANN RESONANCE LIVE";
  const titleWidth = measureVectorText(title, c.titleSize, titleStyle);
  parts.push(buildVectorTextMarkup(title, box.x + c.padX, box.y + c.padTop, c.titleSize, titleStyle));
  const roomForInfo = box.w - c.padX * 2 - titleWidth - l * 1.5;
  const infoSize = l * 0.85;
  const info = [`TOMSK UTC+7 · UPDATED ${tomskClock(graph.updatedAt)}`, `UPDATED ${tomskClock(graph.updatedAt)}`].find(
    (text) => measureVectorText(text, infoSize, infoStyle) <= roomForInfo
  );
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

  // Dates over each of the 3 days, with a dashed line at each midnight.
  const dayWidth = plot.w / 3;
  const dateSize = l;
  const dateTop = plot.y - c.dateRow + (c.dateRow - dateSize) / 2 - l * 0.1;
  for (let i = 0; i < 3; i++) {
    const label = dayLabel(shiftDay(graph.lastDay, i - 2), dayWidth * 0.92, dateSize, dateStyle);
    parts.push(buildCenteredVectorTextMarkup(label, plot.x + dayWidth * (i + 0.5), dateTop, dateSize, dateStyle));
    if (i > 0) {
      const x = (plot.x + dayWidth * i).toFixed(1);
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

  // Hour axis, in Tomsk local time like the source chart, every 3/6/12
  // hours depending on how much room each label has.
  const hourStep = [3, 6, 12].find((step) => (plot.w * step) / PLOT_HOURS >= measureVectorText("18", axisSize, labelStyle) * 2.2) ?? 24;
  for (let h = 0; h <= PLOT_HOURS; h += hourStep) {
    const x = plot.x + (h / PLOT_HOURS) * plot.w;
    parts.push(
      `<line x1="${x.toFixed(1)}" y1="${(plot.y + plot.h).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(plot.y + plot.h + l * 0.35).toFixed(1)}" stroke="${MUTED_COLOR}" stroke-width="${(l * 0.07).toFixed(1)}" />`
    );
    parts.push(buildCenteredVectorTextMarkup(String(h === PLOT_HOURS ? 24 : h % 24), x, plot.y + plot.h + l * 0.6, axisSize, labelStyle));
  }

  return `<g>${parts.join("")}</g>`;
}

export interface SchumannOverlay {
  markup: string;
  /** Where overlays below may start: just under everything drawn, or 0 if nothing was. */
  clearY: number;
}

/**
 * The gauge and live graph for a `width`x`height` canvas, laid out
 * between `top` (the date header's bottom edge) and the kundli. Either
 * part is left out when its data is missing or there isn't room for it
 * to stay legible.
 */
export function buildSchumannMarkup(width: number, height: number, top: number, snapshot: SchumannSnapshot | null | undefined): SchumannOverlay {
  if (!snapshot) return { markup: "", clearY: 0 };
  const minDim = Math.min(width, height);
  const gap = Math.round(minDim * 0.015);
  const startY = top + gap;
  const avail = kundliRect(width, height).top - gap * 2 - startY;
  const landscape = width > height;
  const l = Math.max(12, minDim * (landscape ? 0.016 : 0.019));
  const score = snapshot.score;
  let graph = snapshot.graph;
  const c = graph ? graphChrome(l, graph.cropped) : null;
  const minPlotH = minDim * 0.07;
  // The cropped plot is drawn a bit taller than its native 3.6:1 when
  // there's room, so the frequency bands read clearly.
  const idealAspect = graph ? (graph.cropped ? 2.4 : graph.width / graph.height) : 1;

  let gaugeD = score != null ? minDim * (landscape ? 0.2 : 0.22) : 0;
  let gauge: { cx: number; cy: number } | null = null;
  let graphBox: Box | null = null;

  if (!landscape) {
    const graphW = Math.min(width * 0.94, minDim * 1.6);
    let plotH = graph && c ? (graphW - chromeWidth(c)) / idealAspect : 0;
    const graphH = () => (graph && c ? gap + chromeHeight(c) + plotH : 0);
    // Out of room: shrink the gauge first (down to a floor), then the plot.
    if (gaugeD + graphH() > avail) gaugeD = Math.max(score != null ? minDim * 0.14 : 0, avail - graphH());
    if (gaugeD + graphH() > avail && c) plotH = avail - gaugeD - gap - chromeHeight(c);
    if (plotH < minPlotH) graph = null;
    gaugeD = Math.min(gaugeD, avail - graphH());
    if (gaugeD >= minDim * 0.1) gauge = { cx: width / 2, cy: startY + gaugeD / 2 };
    else gaugeD = 0;
    if (graph && c) graphBox = { x: (width - graphW) / 2, y: startY + (gauge ? gaugeD + gap : 0), w: graphW, h: chromeHeight(c) + plotH };
  } else {
    // Kept short enough that the Panchang summary strip (which sits
    // between this row and the kundli) still has room for a line.
    const rowH = Math.min(avail, Math.round(minDim * 0.19));
    gaugeD = Math.min(gaugeD, rowH);
    const plotH = c ? rowH - chromeHeight(c) : 0;
    if (plotH < minPlotH) graph = null;
    if (gaugeD < minDim * 0.1) gaugeD = 0;
    const maxGraphW = width * 0.94 - (gaugeD ? gaugeD + gap : 0);
    // Wide enough to read, but not stretched past ~8:1.
    const graphW = graph && c ? Math.min(maxGraphW, chromeWidth(c) + plotH * (graph.cropped ? 8 : idealAspect)) : 0;
    const groupW = gaugeD + (gaugeD && graphW ? gap : 0) + graphW;
    const x0 = (width - groupW) / 2;
    if (gaugeD) gauge = { cx: x0 + gaugeD / 2, cy: startY + rowH / 2 };
    if (graph && graphW > 0) graphBox = { x: x0 + groupW - graphW, y: startY, w: graphW, h: rowH };
  }

  const parts: string[] = [];
  let bottom: number | null = null;
  if (gauge && score != null) {
    parts.push(gaugeMarkup(gauge.cx, gauge.cy, gaugeD, score));
    bottom = gauge.cy + gaugeD / 2;
  }
  if (graph && graphBox) {
    parts.push(graphMarkup(graphBox, graph, l));
    bottom = Math.max(bottom ?? 0, graphBox.y + graphBox.h);
  }
  return { markup: parts.join(""), clearY: bottom === null ? 0 : bottom + gap };
}
