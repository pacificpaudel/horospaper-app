import type { KundliData } from "@/lib/astrologyApi";
import { gocharKundli, kundliChartMarkup, MOVED_COLOR, SignStay } from "./kundliOverlay";
import { devanagariMarkup, PANCHANG_FACTS_COLOR, PANCHANG_SUMMARY_COLOR } from "./panchangOverlay";
import { shapeDevanagariText, type ShapedText } from "./devanagariShaper";
import { fittedPlanetBodyMarkup, planetBodyFor } from "./planetBodies";
import { getMoonPhase } from "@/lib/astrology/ephemeris";
import { buildVectorTextMarkup, measureVectorText, TextStyle, wrapVectorText } from "./vectorFont";
import type { Box } from "./schumannOverlay";
import { GOCHAR_THEMES, gocharAssessment, gocharQuality, GocharQuality, gocharThemeReadings, nepaliReasonTexts, VEDHA_BLOCKED_NE } from "@/lib/astrology/gochar";
import { layoutLuckChartView, type GocharLayout } from "./wallpaperLayout";
import type { DailyReading } from "@/lib/dailyReading";

const DEVANAGARI_SCALE = 1.55;

// How far back a graha's last sign change is remembered. The Luck Chart
// keeps drawing the grey "was here" label and arrow from the sign each
// graha last left, until it moves again -- not just on the one day after
// the move -- as long as that move happened within this window.
const MOVE_MEMORY_DAYS = 30;
// How far back to look for when each graha entered its sign -- past
// Saturn's longest stay (~2.5 years, more with retrograde re-entries).
const STAY_LOOKBACK_DAYS = 1100;
const DAY_MS = 86_400_000;

/**
 * The first whole day (1, 2, ...) from `noon`, stepping `direction` (-1
 * back, +1 ahead) at noon UTC like the rest of the chart, on which each
 * graha is in a different sign than today -- with that sign. Grahas still
 * in today's sign after STAY_LOOKBACK_DAYS are left out.
 */
function signChanges(kundli: KundliData, today: KundliData, noon: Date, direction: -1 | 1): Map<string, { day: number; sign: number }> {
  const found = new Map<string, { day: number; sign: number }>();
  for (let day = 1; day <= STAY_LOOKBACK_DAYS && found.size < today.planets.length; day++) {
    const then = gocharKundli(kundli, new Date(noon.getTime() + direction * day * DAY_MS));
    for (const planet of today.planets) {
      if (found.has(planet.name)) continue;
      const other = then.planets.find((p) => p.name === planet.name);
      if (other && other.sign !== planet.sign) found.set(planet.name, { day, sign: other.sign });
    }
  }
  return found;
}

/**
 * Each graha's stay in today's sign -- days already spent there (today
 * counts as one) out of the whole stay, since planets' motion is fully
 * predictable -- and `previous`: the sign each graha last left, for the
 * grey "last position" label. Grahas that moved more than
 * MOVE_MEMORY_DAYS ago keep today's sign there, so they get no label.
 */
function signHistory(kundli: KundliData, today: KundliData, noon: Date): { previous: KundliData; stays: Map<string, SignStay> } {
  const before = signChanges(kundli, today, noon, -1);
  const after = signChanges(kundli, today, noon, 1);
  const stays = new Map<string, SignStay>();
  for (const planet of today.planets) {
    const elapsed = before.get(planet.name)?.day;
    const ahead = after.get(planet.name)?.day;
    if (elapsed !== undefined && ahead !== undefined) stays.set(planet.name, { elapsed, total: elapsed + ahead - 1 });
  }
  return {
    previous: {
      ...today,
      planets: today.planets.map((planet) => {
        const last = before.get(planet.name);
        return { ...planet, sign: last && last.day <= MOVE_MEMORY_DAYS ? last.sign : planet.sign, retro: false };
      }),
    },
    stays,
  };
}

/** Good / neutral / bad transit colours (gocharQuality). */
const QUALITY_COLORS: Record<GocharQuality, string> = {
  good: "#1aff5c",
  neutral: "#e8862a",
  bad: "#ff2020",
};

/** Each graha's full Nepali name, for the full-screen view's Analysis. */
const NEPALI_NAMES: Record<string, string> = {
  Sun: "सूर्य", Moon: "चन्द्र", Mars: "मङ्गल", Mercury: "बुध", Jupiter: "बृहस्पति",
  Venus: "शुक्र", Saturn: "शनि", Rahu: "राहु", Ketu: "केतु",
};

const SIGN_NAMES = ["", "ARIES", "TAURUS", "GEMINI", "CANCER", "LEO", "VIRGO", "LIBRA", "SCORPIO", "SAGITTARIUS", "CAPRICORN", "AQUARIUS", "PISCES"];
/** An Analysis row whose reading another graha outweighs (see gocharThemeReadings). */
const OUTWEIGHED_COLOR = "#999999";
/** The Agreement & Conflict section's heading, in Nepali. */
const THEMES_HEADING_NE = "मेल र द्वन्द्व";

const SIGN_NAMES_NE = ["", "मेष", "वृष", "मिथुन", "कर्कट", "सिंह", "कन्या", "तुला", "वृश्चिक", "धनु", "मकर", "कुम्भ", "मीन"];
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "ST" : n % 10 === 2 && n !== 12 ? "ND" : n % 10 === 3 && n !== 13 ? "RD" : "TH"}`;

/**
 * The "Analysis" panel beside the Luck Chart: for each graha, its house
 * counted from the natal Moon sign (which is what decides good / neutral /
 * bad), the verdict in its colour, and why -- Phaladeepika's stated result
 * for that house, or, for a favorable transit cancelled by vedha, which
 * graha blocks it. Text shrinks until it all fits the box.
 *
 * Roomy (the full-screen view) starts its text larger, keeps the panel at
 * the box's full height, and, given `nepaliNames`, leads each graha's line
 * with its figure and its Nepali name ("☉ सूर्य SUN · 3RD · GOOD"); given
 * `nepaliTitle`, the heading reads "विष्लेषण / ANALYSIS", like the chart's own;
 * given `nepaliReasons`, each reason leads with its Nepali ("लाभ / GAIN").
 */
function analysisMarkup(
  box: Box,
  planets: string[],
  allHouses: Record<string, number>,
  natalMoonSign: number,
  roomy = false,
  nepaliNames?: Record<string, ShapedText>,
  moonIllumination = 0.5,
  nepaliTitle?: ShapedText,
  nepaliReasons?: Record<string, ShapedText>,
  moonSignNe?: ShapedText,
  /** The "i" for the Agreement & Conflict details; off in a home-screen widget, which can't open it. */
  withInfo = true
): string {
  const latinTitle = nepaliTitle ? " / ANALYSIS" : "ANALYSIS";
  const titleWidth = (s: number) => (nepaliTitle ? nepaliTitle.width * s * DEVANAGARI_SCALE : 0) + measureVectorText(latinTitle, s, titleStyle);
  const rows = planets.map((name) => ({ name, house: allHouses[name], ...gocharAssessment(name, allHouses[name], allHouses) }));
  const named = roomy && nepaliNames !== undefined;
  // Grahas whose readings are outweighed by a heavier graha's on the same
  // area of life (see gocharThemeReadings) fade to grey, name and reason.
  const { outweighed } = gocharThemeReadings(allHouses);
  const rowColor = (row: (typeof rows)[number]) => (outweighed.has(row.name) ? OUTWEIGHED_COLOR : QUALITY_COLORS[row.quality]);
  // Each graha's figure, in a FIGURE_W x FIGURE_H box (shares of the text
  // size), then the Nepali name; the coloured dot stands in without them.
  const FIGURE_W = 1.7;
  const FIGURE_H = 1.3;
  const lead = (s: number) => (named ? s * (FIGURE_W + 0.35) : s);
  const nepaliWidth = (name: string, s: number) => (named && nepaliNames[name] ? nepaliNames[name].width * s * DEVANAGARI_SCALE + s * 0.4 : 0);
  const pad = box.w * 0.06;
  // Roomy, less padding above and below, leaving the height to the text.
  const padY = roomy ? Math.min(pad, box.h * 0.04) : pad;
  const innerW = box.w - pad * 2;
  const titleStyle: TextStyle = { face: "clear", color: "#f7c56a", strokeWidth: 0.12, tracking: 0.2 };
  const noteStyle: TextStyle = { face: "clear", color: "#a9b1c4", strokeWidth: 0.11, tracking: 0.08 };
  const reasonStyle: TextStyle = { face: "clear", color: "#d7dce8", strokeWidth: 0.11, tracking: 0.06 };
  // Given `moonSignNe`: "HOUSE FROM MOON: वृश्चिक / SCORPIO".
  const subtitleLead = "HOUSE FROM MOON: ";
  const subtitle = moonSignNe ? ` / ${SIGN_NAMES[natalMoonSign]}` : `${subtitleLead}${SIGN_NAMES[natalMoonSign]}`;
  const subtitleWidth = (s: number) =>
    moonSignNe ? measureVectorText(subtitleLead, s, noteStyle) + moonSignNe.width * s * DEVANAGARI_SCALE + measureVectorText(subtitle, s, noteStyle) : measureVectorText(subtitle, s, noteStyle);
  const footer = "PER PHALADEEPIKA CH. 26";

  // A wide, short box (the portrait full-screen view) sets the grahas in
  // two columns, so the text can stay large instead of shrinking to fit
  // one tall column.
  const columns = roomy && box.w > box.h * 1.4 ? 2 : 1;
  const colGap = pad;
  const colW = (innerW - colGap * (columns - 1)) / columns;
  const perColumn = Math.ceil(rows.length / columns);

  // Largest text size at which every line fits the box's width and height.
  // Starts as large as could fit (much larger in the roomy full-screen view)
  // and shrinks until every line fits.
  // Named, a heading too wide for one line breaks after the graha's name
  // ("3RD · GOOD" on a line of its own) rather than shrinking everything.
  let size = roomy ? Math.min(box.w * 0.056 * columns, box.h * 0.1) : Math.min(box.w * 0.055, box.h * 0.04);
  // A reason line: English, led on its first line (given `nepaliReasons`)
  // by the Nepali meaning -- "लाभ / GAIN", or the Nepali alone on a line
  // ending " /" when the two don't fit together.
  type ReasonLine = { ne?: ShapedText; text: string };
  let layout: { name: string; head: string[]; reason: ReasonLine[]; color: string; reasonColor: string }[] = [];
  let height = 0;
  const lineStep = named ? 1.38 : 1.45;
  // Lines in Nepali step further, past their descenders (the ू of सूर्य).
  const headStep = named ? 1.6 : lineStep;
  // And clear of the line above, for their matras.
  const REASON_NE_AIR = 0.2;
  const reasonNeWidth = (ne: ShapedText, s: number) => ne.width * s * 0.9 * DEVANAGARI_SCALE;
  const reasonLines = (row: (typeof rows)[number], s: number): ReasonLine[] => {
    const english = row.blockedBy ? `GOOD HOUSE, BLOCKED BY ${row.blockedBy.planet.toUpperCase()} IN ${ordinal(row.blockedBy.house)} (VEDHA)` : row.reason;
    const width = colW - lead(s);
    const wrapped = wrapVectorText(english, width, s * 0.9, reasonStyle).map((text) => ({ text }));
    const ne = named ? nepaliReasons?.[row.blockedBy ? VEDHA_BLOCKED_NE : row.reasonNe] : undefined;
    if (!ne) return wrapped;
    const joined = ` / ${english}`;
    if (reasonNeWidth(ne, s) + measureVectorText(joined, s * 0.9, reasonStyle) <= width) return [{ ne, text: joined }];
    return [{ ne, text: " /" }, ...wrapped];
  };
  // Named rows get a little more air above, for the Devanagari's matras.
  const rowHeight = (row: { head: string[]; reason: ReasonLine[] }, s: number) =>
    s * headStep +
    (row.head.length - 1) * s * lineStep +
    row.reason.reduce((sum, line) => sum + s * (line.ne ? headStep + REASON_NE_AIR : lineStep), 0) +
    s * (named ? 0.7 : 0.45);
  const headFits = (name: string, line: string, s: number, first: boolean) => (first ? nepaliWidth(name, s) : 0) + measureVectorText(line, s, titleStyle) <= colW - lead(s);
  for (let attempt = 0; attempt < 60; attempt++) {
    const s = size;
    layout = rows.map((row) => {
      const verdict = `${ordinal(row.house)} · ${row.quality.toUpperCase()}`;
      const whole = `${row.name.toUpperCase()} · ${verdict}`;
      return {
        name: row.name,
        // Only a heading too wide for one line breaks, and only when named.
        head: !named || headFits(row.name, whole, s, true) ? [whole] : [row.name.toUpperCase(), verdict],
        reason: reasonLines(row, s),
        color: rowColor(row),
        reasonColor: outweighed.has(row.name) ? OUTWEIGHED_COLOR : reasonStyle.color!,
      };
    });
    const tallest = Math.max(...Array.from({ length: columns }, (_, c) => layout.slice(c * perColumn, (c + 1) * perColumn).reduce((sum, row) => sum + rowHeight(row, s), 0)));
    height = padY * 2 + s * 1.3 * 1.8 + s * 0.85 * 1.7 + tallest + s * 0.8 * 1.6;
    const widthOk =
      titleWidth(s * 1.3) <= innerW &&
      subtitleWidth(s * 0.85) <= innerW &&
      layout.every((row) => row.head.every((line, k) => headFits(row.name, line, s, k === 0))) &&
      layout.every((row) => row.reason.every((line) => !line.ne || reasonNeWidth(line.ne, s) + measureVectorText(line.text, s * 0.9, reasonStyle) <= colW - lead(s)));
    if (height <= box.h && widthOk) break;
    // Fine steps, so the text ends up as large as the panel allows.
    size *= 0.97;
  }

  const parts = [
    `<rect x="${box.x.toFixed(1)}" y="${box.y.toFixed(1)}" width="${box.w.toFixed(1)}" height="${(roomy ? box.h : Math.min(height, box.h)).toFixed(1)}" rx="${(size * 0.8).toFixed(1)}" fill="#080b16" fill-opacity="0.85" stroke="#f7c56a" stroke-opacity="0.55" stroke-width="${Math.max(1, size * 0.08).toFixed(1)}" />`,
  ];
  let y = box.y + padY;
  const titleSize = size * 1.3;
  let titleX = box.x + pad;
  if (nepaliTitle) {
    // Larger than the Latin and on its baseline, as in the chart's title.
    parts.push(devanagariMarkup(nepaliTitle, titleX, y + titleSize - titleSize * DEVANAGARI_SCALE * 0.72, titleSize * DEVANAGARI_SCALE, titleStyle.color!));
    titleX += nepaliTitle.width * titleSize * DEVANAGARI_SCALE;
  }
  parts.push(buildVectorTextMarkup(latinTitle, titleX, y, titleSize, titleStyle));
  y += size * 1.3 * 1.8;
  let subtitleX = box.x + pad;
  if (moonSignNe) {
    const noteSize = size * 0.85;
    parts.push(buildVectorTextMarkup(subtitleLead, subtitleX, y, noteSize, noteStyle));
    subtitleX += measureVectorText(subtitleLead, noteSize, noteStyle);
    parts.push(devanagariMarkup(moonSignNe, subtitleX, y + noteSize - noteSize * DEVANAGARI_SCALE * 0.72, noteSize * DEVANAGARI_SCALE, noteStyle.color!));
    subtitleX += moonSignNe.width * noteSize * DEVANAGARI_SCALE;
  }
  parts.push(buildVectorTextMarkup(subtitle, subtitleX, y, size * 0.85, noteStyle));
  y += size * 0.85 * 1.7;
  const rowsTop = y;
  let bottom = y;
  layout.forEach((row, i) => {
    const column = Math.floor(i / perColumn);
    if (i % perColumn === 0) y = rowsTop;
    const x = box.x + pad + column * (colW + colGap);
    const textX = x + lead(size);
    const body = planetBodyFor(row.name);
    const nepali = nepaliNames?.[row.name];
    if (named) {
      y += size * 0.25;
      if (body) parts.push(fittedPlanetBodyMarkup(body, `analysis-body-${i}`, x + (size * FIGURE_W) / 2, y + size / 2, size * FIGURE_W, size * FIGURE_H, moonIllumination));
      // Larger than the Latin and on its baseline, as in the title.
      if (nepali) parts.push(devanagariMarkup(nepali, textX, y + size - size * DEVANAGARI_SCALE * 0.72, size * DEVANAGARI_SCALE, row.color));
    } else {
      parts.push(`<circle cx="${(x + size * 0.35).toFixed(1)}" cy="${(y + size / 2).toFixed(1)}" r="${(size * 0.35).toFixed(1)}" fill="${row.color}" />`);
    }
    row.head.forEach((line, k) => {
      parts.push(buildVectorTextMarkup(line, textX + (k === 0 ? nepaliWidth(row.name, size) : 0), y, size, { ...titleStyle, color: row.color, tracking: 0.1 }));
      y += size * (k === 0 ? headStep : lineStep);
    });
    for (const line of row.reason) {
      let lineX = textX;
      if (line.ne) y += size * REASON_NE_AIR;
      if (line.ne) {
        const neSize = size * 0.9 * DEVANAGARI_SCALE;
        parts.push(devanagariMarkup(line.ne, lineX, y + size * 0.9 - neSize * 0.72, neSize, row.reasonColor));
        lineX += reasonNeWidth(line.ne, size);
      }
      parts.push(buildVectorTextMarkup(line.text, lineX, y, size * 0.9, { ...reasonStyle, color: row.reasonColor }));
      y += size * (line.ne ? headStep : lineStep);
    }
    y += size * 0.45;
    bottom = Math.max(bottom, y);
  });
  parts.push(buildVectorTextMarkup(footer, box.x + pad, bottom + size * 0.3, size * 0.8, noteStyle));
  // Named (the full-screen view): the "i" that opens the Agreement &
  // Conflict details -- the page lays its button over this (see
  // analysisInfoButton and LuckChartLayer).
  if (named && withInfo) {
    const { cx, cy, r } = analysisInfoButton(box);
    const stroke = Math.max(1, r * 0.12);
    parts.push(
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="#080b16" stroke="#f7c56a" stroke-width="${stroke.toFixed(1)}" />`,
      `<circle cx="${cx.toFixed(1)}" cy="${(cy - r * 0.45).toFixed(1)}" r="${(r * 0.13).toFixed(1)}" fill="#f7c56a" />`,
      `<rect x="${(cx - r * 0.1).toFixed(1)}" y="${(cy - r * 0.2).toFixed(1)}" width="${(r * 0.2).toFixed(1)}" height="${(r * 0.72).toFixed(1)}" rx="${(r * 0.06).toFixed(1)}" fill="#f7c56a" />`
    );
  }
  return `<g>${parts.join("")}</g>`;
}

/**
 * "● GOOD  ● NEUTRAL  ● BAD", plus "- - LAST POSITION" in grey when a
 * graha's previous sign is drawn and `moved` asks for it, centered on `cx`
 * in a row `h` tall from `top`; shrinks only if it would overflow `maxW`.
 * (The grey legend used to share the title line, which shrank the whole
 * "LUCK CHART" title.)
 */
function qualityLegend(cx: number, top: number, h: number, maxW: number, moved: boolean): string {
  const style: TextStyle = { face: "clear", color: "#c9cfdc", strokeWidth: 0.12, tracking: 0.14 };
  type Kind = "dot" | "dash";
  const entries: { label: string; color: string; kind: Kind }[] = [
    ...(["good", "neutral", "bad"] as const).map((quality) => ({ label: quality.toUpperCase(), color: QUALITY_COLORS[quality], kind: "dot" as Kind })),
    ...(moved ? [{ label: "LAST POSITION", color: MOVED_COLOR, kind: "dash" as Kind }] : []),
  ];
  const styleOf = (color: string): TextStyle => ({ ...style, color: color === MOVED_COLOR ? MOVED_COLOR : style.color });
  const markerW = (size: number, kind: Kind) => size * (kind === "dash" ? 1.6 : 1.1);
  const rowWidth = (size: number) =>
    entries.reduce((sum, e) => sum + markerW(size, e.kind) + measureVectorText(e.label, size, styleOf(e.color)), 0) + size * 1.6 * (entries.length - 1);
  const ideal = h * 0.42;
  const size = Math.min(ideal, ideal * ((maxW * 0.96) / rowWidth(ideal)));
  const gap = size * 1.6;
  let x = cx - rowWidth(size) / 2;
  const y = top + (h - size) / 2;
  const mid = y + size / 2;
  const midY = mid.toFixed(1);
  return entries
    .map(({ label, color, kind }) => {
      const marker =
        kind === "dash"
          ? `<line x1="${x.toFixed(1)}" y1="${midY}" x2="${(x + size * 1.2).toFixed(1)}" y2="${midY}" stroke="${color}" stroke-width="${Math.max(1, size * 0.14).toFixed(1)}" stroke-dasharray="${(size * 0.3).toFixed(1)} ${(size * 0.2).toFixed(1)}" />`
          : `<circle cx="${(x + size * 0.38).toFixed(1)}" cy="${midY}" r="${(size * 0.38).toFixed(1)}" fill="${color}" />`;
      const markup = marker + buildVectorTextMarkup(label, x + markerW(size, kind), y, size, styleOf(color));
      x += markerW(size, kind) + measureVectorText(label, size, styleOf(color)) + gap;
      return markup;
    })
    .join("");
}

/** The full-screen Analysis panel's "i" circle: in its bottom-right corner. */
export function analysisInfoButton(box: Box): { cx: number; cy: number; r: number } {
  const r = Math.max(12, Math.min(box.w, box.h) * 0.045);
  return { cx: box.x + box.w - r * 1.5, cy: box.y + box.h - r * 1.5, r };
}

/** What the "i" opens: the Agreement & Conflict details, as plain text for the page to lay out. */
export interface LuckChartInfo {
  /** The "i" circle, in the SVG's pixels. */
  button: { cx: number; cy: number; r: number };
  title: { ne: string; en: string };
  /** How a conflict is decided, in one line. */
  rule: string;
  /** One per area of life two or more grahas speak to, in the agreeing or winning side's colour. */
  lines: { ne: string; en: string; text: string; color: string }[];
}

/**
 * Each area of life two or more grahas' readings speak to (see
 * gocharThemeReadings), naming only who wins -- "SATURN WINS OVER SUN ·
 * BAD" -- or who agrees.
 */
function agreementLines(allHouses: Record<string, number>): LuckChartInfo["lines"] {
  const names = (list: string[]) => list.map((name) => name.toUpperCase()).join(", ");
  return gocharThemeReadings(allHouses).themes.map((reading) => ({
    ...GOCHAR_THEMES[reading.theme],
    text:
      reading.kind === "agree"
        ? `${names(reading.winners)} AGREE · ${reading.quality.toUpperCase()}`
        : reading.kind === "balanced"
          ? `${names(reading.winners)} BALANCE OUT`
          : `${names(reading.winners)} ${reading.winners.length > 1 ? "WIN" : "WINS"} OVER ${names(reading.losers)} · ${reading.quality.toUpperCase()}`,
    color: QUALITY_COLORS[reading.quality],
  }));
}

// Server-only: the Panchang text here is HarfBuzz-shaped (devanagariShaper.ts
// reads its font from disk), so this stays out of kundliOverlay.ts, which
// the birth-profile form also loads in the browser.

/**
 * The wallpaper's gochar block, into the boxes wallpaperLayout.ts placed:
 * a "भाग्य कुन्डली / LUCK CHART" caption with the day's Panchang facts on one line
 * under it, the chart, and the Panchang prediction as a strip below.
 * The chart is today's gochar on the person's lagna (see gocharKundli),
 * judged at noon UTC of `onDate` ("YYYY-MM-DD") like the day's gochar
 * reading; each graha is coloured green / brown / red for a good / neutral
 * / bad transit from the natal Moon sign, and any graha that changed sign
 * in the last MOVE_MEMORY_DAYS days also keeps a grey, struck-through label
 * (with an arrow) in the house it last left. Each graha's label is
 * followed by a small pie of its stay in that sign: green for the days
 * already spent there, red for the days left. The birth chart itself
 * stays in the form.
 */
const MONTH_ABBREVIATIONS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
/** The title's date, as a share of the title's cap height. */
const DATE_SCALE = 0.5;

export function buildGocharMarkup(
  layout: GocharLayout,
  kundli: KundliData,
  onDate: string,
  /**
   * `zoom`: the full-screen view; `nepaliNames`: each graha's shaped Nepali
   * name, `analysisTitle` the shaped "विष्लेषण" and `nepaliReasons` each
   * Nepali reason (by its text), and `moonSignNe` the natal Moon sign in
   * Nepali, for its Analysis.
   */
  opts: {
    zoom?: boolean;
    nepaliNames?: Record<string, ShapedText>;
    analysisTitle?: ShapedText;
    nepaliReasons?: Record<string, ShapedText>;
    moonSignNe?: ShapedText;
    /** Just the chart, or just the Analysis -- the Android home-screen widgets (see buildLuckChartWidgetSvg). */
    only?: "chart" | "analysis";
  } = {}
): string {
  const { x0, y0, size, caption, facts, strip } = layout;
  const [year, month, day] = onDate.split("-").map(Number);
  const noon = new Date(Date.UTC(year, month - 1, day, 12));
  const today = gocharKundli(kundli, noon);
  const { previous, stays } = signHistory(kundli, today, noon);
  const moonIllumination = getMoonPhase(noon).illumination;
  const moved = today.planets.some((planet) => previous.planets.find((before) => before.name === planet.name)?.sign !== planet.sign);

  // Each graha coloured by how its transit sits, counted from the natal
  // Moon sign (the rashi) -- see gocharQuality.
  // A favorable transit obstructed by vedha (another graha in its paired
  // house) shows as neutral, so every graha's current house is passed in.
  const natalMoonSign = kundli.planets.find((planet) => planet.name === "Moon")?.sign;
  const houseFromMoon = (sign: number) => ((sign - (natalMoonSign ?? 1) + 12) % 12) + 1;
  const allHouses = Object.fromEntries(today.planets.map((planet) => [planet.name, houseFromMoon(planet.sign)]));
  const colorFor = (name: string) => {
    if (natalMoonSign === undefined || allHouses[name] === undefined) return "#fdf6e6";
    return QUALITY_COLORS[gocharQuality(name, allHouses[name], allHouses)];
  };

  // House backgrounds: green where every graha in the house is good, brown
  // where every one is neutral, red where every one is bad. A house with
  // two different verdicts is split half and half in those two colours
  // (good/bad, good/neutral or neutral/bad), each graha's label in its own
  // half; with all three, good and bad take the halves (they outrank
  // neutral) and neutral labels go wherever there's room. Empty: no tint.
  // Zoomed, neutral grahas tint nothing: only green and red backgrounds.
  const qualitiesByHouse: GocharQuality[][] = Array.from({ length: 12 }, () => []);
  if (natalMoonSign !== undefined) {
    for (const planet of today.planets) {
      qualitiesByHouse[(planet.sign - today.ascendantSign + 12) % 12].push(gocharQuality(planet.name, allHouses[planet.name], allHouses));
    }
  }
  const tinted = opts.zoom ? (["good", "bad"] as const) : (["good", "neutral", "bad"] as const);
  const houseFill = (i: number): string | [string, string] | null => {
    const present = tinted.filter((q) => qualitiesByHouse[i].includes(q));
    if (!present.length) return null;
    if (present.length === 1) return QUALITY_COLORS[present[0]];
    const [first, second] = present.length === 3 ? (["good", "bad"] as const) : present;
    return [QUALITY_COLORS[first], QUALITY_COLORS[second]];
  };

  const stroke = Math.max(1.2, size * 0.006);
  const radius = size * 0.02;
  const titleStyle: TextStyle = { face: "clear", color: "#f7c56a", strokeWidth: 0.12, tracking: 0.16 };
  // Title: "भाग्य कुन्डली / LUCK CHART" (Devanagari shaped, Latin in the
  // vector font). Devanagari is drawn DEVANAGARI_SCALE larger, on the same
  // baseline as the Latin, so the two read as one line; both shrink
  // together only if needed to fit the width. The grey "last position"
  // legend lives in the colour legend row (qualityLegend), not here.
  // A small date ("8.OCT.2026") follows the name, on the same baseline.
  const latin = " / LUCK CHART";
  const dateText = `${day}.${MONTH_ABBREVIATIONS[month - 1]}.${year}`;
  const dateStyle: TextStyle = { face: "clear", color: "#c9cfdc", strokeWidth: 0.12, tracking: 0.12 };
  const dateGap = (size: number) => size * 0.6;
  const dateWidth = (size: number) => dateGap(size) + measureVectorText(dateText, size * DATE_SCALE, dateStyle);
  const widthAt = (size: number) => layout.titleText.width * size * DEVANAGARI_SCALE + measureVectorText(latin, size, titleStyle) + dateWidth(size);
  const idealSize = layout.titleHeight * 0.4;
  const textSize = Math.min(idealSize, idealSize * ((caption.w * 0.92) / widthAt(idealSize)));
  const devanagariWidth = layout.titleText.width * textSize * DEVANAGARI_SCALE;
  const centerX = caption.x + caption.w / 2;
  const textLeft = centerX - widthAt(textSize) / 2;
  const textTop = caption.y + (layout.titleHeight - textSize) / 2;

  const chart = kundliChartMarkup(x0, y0, size, today, null, previous, colorFor, houseFill, natalMoonSign, (name) => stays.get(name), opts.zoom, moonIllumination);
  const analysis = (withInfo: boolean) =>
    layout.analysis && natalMoonSign !== undefined
      ? analysisMarkup(layout.analysis, today.planets.map((p) => p.name), allHouses, natalMoonSign, opts.zoom, opts.nepaliNames, moonIllumination, opts.analysisTitle, opts.nepaliReasons, opts.moonSignNe, withInfo)
      : "";
  if (opts.only === "chart") return `<g>${chart}</g>`;
  if (opts.only === "analysis") return `<g>${analysis(false)}</g>`;

  const parts = [
    `<rect x="${caption.x.toFixed(1)}" y="${caption.y.toFixed(1)}" width="${caption.w.toFixed(1)}" height="${(caption.h + stroke).toFixed(1)}" rx="${radius.toFixed(1)}" fill="#080b16" />`,
    devanagariMarkup(layout.titleText, textLeft, textTop + textSize - textSize * DEVANAGARI_SCALE * 0.72, textSize * DEVANAGARI_SCALE, "#f7c56a"),
    buildVectorTextMarkup(latin, textLeft + devanagariWidth, textTop, textSize, titleStyle),
    buildVectorTextMarkup(
      dateText,
      textLeft + devanagariWidth + measureVectorText(latin, textSize, titleStyle) + dateGap(textSize),
      textTop + textSize * (1 - DATE_SCALE),
      textSize * DATE_SCALE,
      dateStyle
    ),
    facts ? devanagariMarkup(facts.text, centerX, caption.y + layout.titleHeight + (caption.h - layout.legendHeight - layout.titleHeight - facts.size) / 2 - facts.size * 0.15, facts.size, PANCHANG_FACTS_COLOR, "center") : "",
    // Zoomed, the legend is just the three colours.
    qualityLegend(centerX, caption.y + caption.h - layout.legendHeight, layout.legendHeight, caption.w * (opts.zoom ? 0.6 : 1), moved && !opts.zoom),
    chart,
    analysis(true),
  ];
  if (strip) {
    const { box, lines, size: lineSize, lineHeight, padY } = strip;
    parts.push(
      `<rect x="${box.x.toFixed(1)}" y="${box.y.toFixed(1)}" width="${box.w.toFixed(1)}" height="${box.h.toFixed(1)}" rx="${radius.toFixed(1)}" fill="#080b16" fill-opacity="0.82" stroke="#f7c56a" stroke-opacity="0.55" stroke-width="${stroke.toFixed(1)}" />`,
      ...lines.map((line, i) => devanagariMarkup(line, box.x + box.w / 2, box.y + padY + i * lineHeight, lineSize, PANCHANG_SUMMARY_COLOR, "center"))
    );
  }
  return `<g>${parts.join("")}</g>`;
}

/**
 * The full-screen Luck Chart view as a standalone SVG document: the same
 * gochar block and Analysis panel the wallpaper draws, laid out to fill a
 * `width`x`height` screen on a plain dark background (see
 * layoutLuckChartView). Vector-only, like the wallpaper, so it stays sharp
 * at any size. Also returns what its Analysis panel's "i" opens (null
 * without a natal Moon sign, when there's no Analysis).
 */
export async function buildLuckChartViewSvg(
  width: number,
  height: number,
  kundli: KundliData,
  onDate: string,
  panchang: DailyReading["panchang"]
): Promise<{ svg: string; info: LuckChartInfo | null }> {
  const shapeAll = (texts: [string, string][]) => Promise.all(texts.map(async ([key, text]) => [key, await shapeDevanagariText(text)] as const));
  const moonSign = kundli.planets.find((planet) => planet.name === "Moon")?.sign;
  const moonSignName = moonSign !== undefined ? SIGN_NAMES_NE[moonSign] : undefined;
  const [layout, names, analysisTitle, reasons, moonSignNe] = await Promise.all([
    layoutLuckChartView(width, height, panchang),
    shapeAll(Object.entries(NEPALI_NAMES)),
    shapeDevanagariText("विष्लेषण"),
    shapeAll(nepaliReasonTexts().map((text) => [text, text])),
    moonSignName ? shapeDevanagariText(moonSignName) : undefined,
  ]);
  const markup = buildGocharMarkup(layout, kundli, onDate, {
    zoom: true,
    nepaliNames: Object.fromEntries(names),
    analysisTitle,
    nepaliReasons: Object.fromEntries(reasons),
    moonSignNe,
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#05070f" />${markup}</svg>`;
  if (!layout.analysis || moonSign === undefined) return { svg, info: null };

  // Today's house from the natal Moon for each graha, as buildGocharMarkup judges them.
  const [year, month, day] = onDate.split("-").map(Number);
  const today = gocharKundli(kundli, new Date(Date.UTC(year, month - 1, day, 12)));
  const allHouses = Object.fromEntries(today.planets.map((planet) => [planet.name, ((planet.sign - moonSign + 12) % 12) + 1]));
  return {
    svg,
    info: {
      button: analysisInfoButton(layout.analysis),
      title: { ne: THEMES_HEADING_NE, en: "AGREEMENT & CONFLICT" },
      rule: "WHERE GRAHAS DISAGREE, THE SLOWER ONE WINS: SATURN 5 · RAHU, KETU, JUPITER 4 · MARS 3 · SUN, VENUS, MERCURY 2 · MOON 1 (NEUTRAL READINGS COUNT HALF; VEDHA-BLOCKED ONES DON'T COUNT).",
      lines: agreementLines(allHouses),
    },
  };
}

/**
 * A home-screen widget's picture (see app/api/widget): just today's Luck
 * Chart, or just its Analysis, drawn the same way as the full-screen view
 * to fill a `width`x`height` widget on the app's dark background.
 */
export async function buildLuckChartWidgetSvg(
  kind: "chart" | "analysis",
  width: number,
  height: number,
  kundli: KundliData,
  onDate: string
): Promise<string> {
  const moonSign = kundli.planets.find((planet) => planet.name === "Moon")?.sign;
  const moonSignName = moonSign !== undefined ? SIGN_NAMES_NE[moonSign] : undefined;
  const shapeAll = (texts: [string, string][]) => Promise.all(texts.map(async ([key, text]) => [key, await shapeDevanagariText(text)] as const));
  const [titleText, names, analysisTitle, reasons, moonSignNe] = await Promise.all([
    shapeDevanagariText("भाग्य कुन्डली"),
    shapeAll(Object.entries(NEPALI_NAMES)),
    shapeDevanagariText("विष्लेषण"),
    shapeAll(nepaliReasonTexts().map((text) => [text, text])),
    moonSignName ? shapeDevanagariText(moonSignName) : undefined,
  ]);
  const pad = Math.round(Math.min(width, height) * 0.03);
  const size = Math.min(width, height) - pad * 2;
  // Only the chart's square or the analysis box is drawn (opts.only); the rest is unused.
  const layout: GocharLayout = {
    x0: (width - size) / 2,
    y0: (height - size) / 2,
    size,
    caption: { x: 0, y: 0, w: width, h: 0 },
    titleHeight: 0,
    legendHeight: 0,
    titleText,
    facts: null,
    analysis: { x: pad, y: pad, w: width - pad * 2, h: height - pad * 2 },
    strip: null,
  };
  const markup = buildGocharMarkup(layout, kundli, onDate, {
    zoom: true,
    nepaliNames: Object.fromEntries(names),
    analysisTitle,
    nepaliReasons: Object.fromEntries(reasons),
    moonSignNe,
    only: kind,
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#05070f" />${markup}</svg>`;
}
