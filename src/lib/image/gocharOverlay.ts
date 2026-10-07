import type { KundliData } from "@/lib/astrologyApi";
import { gocharKundli, kundliChartMarkup, MOVED_COLOR, SignStay, stayPieMarkup } from "./kundliOverlay";
import { devanagariMarkup, PANCHANG_FACTS_COLOR, PANCHANG_SUMMARY_COLOR } from "./panchangOverlay";
import { buildVectorTextMarkup, measureVectorText, TextStyle, wrapVectorText } from "./vectorFont";
import type { Box } from "./schumannOverlay";
import { gocharAssessment, gocharQuality, GocharQuality } from "@/lib/astrology/gochar";
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
  good: "#3ecf6e",
  neutral: "#c08a50",
  bad: "#ff4d4d",
};

const SIGN_NAMES = ["", "ARIES", "TAURUS", "GEMINI", "CANCER", "LEO", "VIRGO", "LIBRA", "SCORPIO", "SAGITTARIUS", "CAPRICORN", "AQUARIUS", "PISCES"];
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "ST" : n % 10 === 2 && n !== 12 ? "ND" : n % 10 === 3 && n !== 13 ? "RD" : "TH"}`;

/**
 * The "Analysis" panel beside the Luck Chart: for each graha, its house
 * counted from the natal Moon sign (which is what decides good / neutral /
 * bad), the verdict in its colour, and why -- Phaladeepika's stated result
 * for that house, or, for a favorable transit cancelled by vedha, which
 * graha blocks it. Text shrinks until it all fits the box.
 */
function analysisMarkup(box: Box, planets: string[], allHouses: Record<string, number>, natalMoonSign: number, roomy = false): string {
  const rows = planets.map((name) => ({ name, house: allHouses[name], ...gocharAssessment(name, allHouses[name], allHouses) }));
  const pad = box.w * 0.06;
  const innerW = box.w - pad * 2;
  const titleStyle: TextStyle = { face: "clear", color: "#f7c56a", strokeWidth: 0.12, tracking: 0.2 };
  const noteStyle: TextStyle = { face: "clear", color: "#a9b1c4", strokeWidth: 0.11, tracking: 0.08 };
  const reasonStyle: TextStyle = { face: "clear", color: "#d7dce8", strokeWidth: 0.11, tracking: 0.06 };
  const subtitle = `HOUSE FROM MOON: ${SIGN_NAMES[natalMoonSign]}`;
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
  let size = roomy ? Math.min(box.w * 0.045 * columns, box.h * 0.08) : Math.min(box.w * 0.055, box.h * 0.04);
  let layout: { head: string; reason: string[]; color: string }[] = [];
  let height = 0;
  const rowHeight = (row: { reason: string[] }, s: number) => (1 + row.reason.length) * s * 1.45 + s * 0.45;
  for (let attempt = 0; attempt < 40; attempt++) {
    const s = size;
    const fit = (text: string, style: TextStyle, w = colW) => measureVectorText(text, s, style) <= w;
    layout = rows.map((row) => ({
      head: `${row.name.toUpperCase()} · ${ordinal(row.house)} · ${row.quality.toUpperCase()}`,
      reason: wrapVectorText(row.blockedBy ? `GOOD HOUSE, BLOCKED BY ${row.blockedBy.planet.toUpperCase()} IN ${ordinal(row.blockedBy.house)} (VEDHA)` : row.reason, colW - s, s * 0.9, reasonStyle),
      color: QUALITY_COLORS[row.quality],
    }));
    const tallest = Math.max(...Array.from({ length: columns }, (_, c) => layout.slice(c * perColumn, (c + 1) * perColumn).reduce((sum, row) => sum + rowHeight(row, s), 0)));
    height = pad * 2 + s * 1.3 * 1.8 + s * 0.85 * 1.7 + tallest + s * 0.8 * 1.6;
    const widthOk = fit("ANALYSIS", titleStyle, innerW) && measureVectorText(subtitle, s * 0.85, noteStyle) <= innerW && layout.every((row) => fit(row.head, titleStyle, colW - s));
    if (height <= box.h && widthOk) break;
    size *= 0.93;
  }

  const parts = [
    `<rect x="${box.x.toFixed(1)}" y="${box.y.toFixed(1)}" width="${box.w.toFixed(1)}" height="${Math.min(height, box.h).toFixed(1)}" rx="${(size * 0.8).toFixed(1)}" fill="#080b16" fill-opacity="0.85" stroke="#f7c56a" stroke-opacity="0.55" stroke-width="${Math.max(1, size * 0.08).toFixed(1)}" />`,
  ];
  let y = box.y + pad;
  parts.push(buildVectorTextMarkup("ANALYSIS", box.x + pad, y, size * 1.3, titleStyle));
  y += size * 1.3 * 1.8;
  parts.push(buildVectorTextMarkup(subtitle, box.x + pad, y, size * 0.85, noteStyle));
  y += size * 0.85 * 1.7;
  const rowsTop = y;
  let bottom = y;
  layout.forEach((row, i) => {
    const column = Math.floor(i / perColumn);
    if (i % perColumn === 0) y = rowsTop;
    const x = box.x + pad + column * (colW + colGap);
    parts.push(`<circle cx="${(x + size * 0.35).toFixed(1)}" cy="${(y + size / 2).toFixed(1)}" r="${(size * 0.35).toFixed(1)}" fill="${row.color}" />`);
    parts.push(buildVectorTextMarkup(row.head, x + size, y, size, { ...titleStyle, color: row.color, tracking: 0.1 }));
    y += size * 1.45;
    for (const line of row.reason) {
      parts.push(buildVectorTextMarkup(line, x + size, y, size * 0.9, reasonStyle));
      y += size * 1.45;
    }
    y += size * 0.45;
    bottom = Math.max(bottom, y);
  });
  parts.push(buildVectorTextMarkup(footer, box.x + pad, bottom + size * 0.3, size * 0.8, noteStyle));
  return `<g>${parts.join("")}</g>`;
}

/**
 * "● GOOD  ● NEUTRAL  ● BAD", plus "- - LAST POSITION" in grey when a
 * graha's previous sign is drawn, centered on `cx` in a row `h` tall from
 * `top`; shrinks only if it would overflow `maxW`. (The grey legend used
 * to share the title line, which shrank the whole "LUCK CHART" title.)
 */
function qualityLegend(cx: number, top: number, h: number, maxW: number, moved: boolean, zoom = false): string {
  const style: TextStyle = { face: "clear", color: "#c9cfdc", strokeWidth: 0.12, tracking: 0.14 };
  type Kind = "dot" | "dash" | "pie";
  const entries: { label: string; color: string; kind: Kind }[] = [
    ...(["good", "neutral", "bad"] as const).map((quality) => ({ label: quality.toUpperCase(), color: QUALITY_COLORS[quality], kind: "dot" as Kind })),
    ...(moved ? [{ label: "LAST POSITION", color: MOVED_COLOR, kind: "dash" as Kind }] : []),
    // Zoomed, the pies carry percentages; say what they are.
    ...(zoom ? [{ label: "% OF STAY IN SIGN: PASSED / LEFT", color: "#c9cfdc", kind: "pie" as Kind }] : []),
  ];
  const styleOf = (color: string): TextStyle => ({ ...style, color: color === MOVED_COLOR ? MOVED_COLOR : style.color });
  const markerW = (size: number, kind: Kind) => size * (kind === "dash" ? 1.6 : kind === "pie" ? 1.45 : 1.1);
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
          : kind === "pie"
            ? stayPieMarkup(x + size * 0.55, mid, size * 0.55, 0.65)
            : `<circle cx="${(x + size * 0.38).toFixed(1)}" cy="${midY}" r="${(size * 0.38).toFixed(1)}" fill="${color}" />`;
      const markup = marker + buildVectorTextMarkup(label, x + markerW(size, kind), y, size, styleOf(color));
      x += markerW(size, kind) + measureVectorText(label, size, styleOf(color)) + gap;
      return markup;
    })
    .join("");
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
export function buildGocharMarkup(layout: GocharLayout, kundli: KundliData, onDate: string, opts: { zoom?: boolean } = {}): string {
  const { x0, y0, size, caption, facts, strip } = layout;
  const [year, month, day] = onDate.split("-").map(Number);
  const noon = new Date(Date.UTC(year, month - 1, day, 12));
  const today = gocharKundli(kundli, noon);
  const { previous, stays } = signHistory(kundli, today, noon);
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
  const qualitiesByHouse: GocharQuality[][] = Array.from({ length: 12 }, () => []);
  if (natalMoonSign !== undefined) {
    for (const planet of today.planets) {
      qualitiesByHouse[(planet.sign - today.ascendantSign + 12) % 12].push(gocharQuality(planet.name, allHouses[planet.name], allHouses));
    }
  }
  const houseFill = (i: number): string | [string, string] | null => {
    const present = (["good", "neutral", "bad"] as const).filter((q) => qualitiesByHouse[i].includes(q));
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
  const latin = " / LUCK CHART";
  const widthAt = (size: number) => layout.titleText.width * size * DEVANAGARI_SCALE + measureVectorText(latin, size, titleStyle);
  const idealSize = layout.titleHeight * 0.4;
  const textSize = Math.min(idealSize, idealSize * ((caption.w * 0.92) / widthAt(idealSize)));
  const devanagariWidth = layout.titleText.width * textSize * DEVANAGARI_SCALE;
  const centerX = caption.x + caption.w / 2;
  const textLeft = centerX - widthAt(textSize) / 2;
  const textTop = caption.y + (layout.titleHeight - textSize) / 2;

  const parts = [
    `<rect x="${caption.x.toFixed(1)}" y="${caption.y.toFixed(1)}" width="${caption.w.toFixed(1)}" height="${(caption.h + stroke).toFixed(1)}" rx="${radius.toFixed(1)}" fill="#080b16" />`,
    devanagariMarkup(layout.titleText, textLeft, textTop + textSize - textSize * DEVANAGARI_SCALE * 0.72, textSize * DEVANAGARI_SCALE, "#f7c56a"),
    buildVectorTextMarkup(latin, textLeft + devanagariWidth, textTop, textSize, titleStyle),
    facts ? devanagariMarkup(facts.text, centerX, caption.y + layout.titleHeight + (caption.h - layout.legendHeight - layout.titleHeight - facts.size) / 2 - facts.size * 0.15, facts.size, PANCHANG_FACTS_COLOR, "center") : "",
    qualityLegend(centerX, caption.y + caption.h - layout.legendHeight, layout.legendHeight, caption.w, moved, opts.zoom),
    kundliChartMarkup(x0, y0, size, today, null, previous, colorFor, houseFill, natalMoonSign, (name) => stays.get(name), opts.zoom),
    layout.analysis && natalMoonSign !== undefined ? analysisMarkup(layout.analysis, today.planets.map((p) => p.name), allHouses, natalMoonSign, opts.zoom) : "",
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
 * at any size.
 */
export async function buildLuckChartViewSvg(width: number, height: number, kundli: KundliData, onDate: string, panchang: DailyReading["panchang"]): Promise<string> {
  const layout = await layoutLuckChartView(width, height, panchang);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#05070f" />${buildGocharMarkup(layout, kundli, onDate, { zoom: true })}</svg>`;
}
