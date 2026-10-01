import type { KundliData } from "@/lib/astrologyApi";
import { gocharKundli, kundliChartMarkup, MOVED_COLOR } from "./kundliOverlay";
import { devanagariMarkup, PANCHANG_FACTS_COLOR, PANCHANG_SUMMARY_COLOR } from "./panchangOverlay";
import { buildVectorTextMarkup, measureVectorText, TextStyle, wrapVectorText } from "./vectorFont";
import type { Box } from "./schumannOverlay";
import { gocharAssessment, gocharQuality, GocharQuality } from "@/lib/astrology/gochar";
import type { GocharLayout } from "./wallpaperLayout";

const DEVANAGARI_SCALE = 1.55;

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
function analysisMarkup(box: Box, planets: string[], allHouses: Record<string, number>, natalMoonSign: number): string {
  const rows = planets.map((name) => ({ name, house: allHouses[name], ...gocharAssessment(name, allHouses[name], allHouses) }));
  const pad = box.w * 0.06;
  const innerW = box.w - pad * 2;
  const titleStyle: TextStyle = { face: "clear", color: "#f7c56a", strokeWidth: 0.12, tracking: 0.2 };
  const noteStyle: TextStyle = { face: "clear", color: "#a9b1c4", strokeWidth: 0.11, tracking: 0.08 };
  const reasonStyle: TextStyle = { face: "clear", color: "#d7dce8", strokeWidth: 0.11, tracking: 0.06 };
  const subtitle = `HOUSE FROM MOON: ${SIGN_NAMES[natalMoonSign]}`;
  const footer = "PER PHALADEEPIKA CH. 26";

  // Largest text size at which every line fits the box's width and height.
  let size = Math.min(box.w * 0.055, box.h * 0.04);
  let layout: { head: string; reason: string[]; color: string }[] = [];
  let height = 0;
  for (let attempt = 0; attempt < 40; attempt++) {
    const s = size;
    const fit = (text: string, style: TextStyle) => measureVectorText(text, s, style) <= innerW;
    layout = rows.map((row) => ({
      head: `${row.name.toUpperCase()} · ${ordinal(row.house)} · ${row.quality.toUpperCase()}`,
      reason: wrapVectorText(row.blockedBy ? `GOOD HOUSE, BLOCKED BY ${row.blockedBy.planet.toUpperCase()} IN ${ordinal(row.blockedBy.house)} (VEDHA)` : row.reason, innerW, s * 0.9, reasonStyle),
      color: QUALITY_COLORS[row.quality],
    }));
    const lines = layout.reduce((sum, row) => sum + 1 + row.reason.length, 0);
    height = pad * 2 + s * 1.3 * 1.8 + s * 0.85 * 1.7 + lines * s * 1.45 + rows.length * s * 0.45 + s * 0.8 * 1.6;
    const widthOk = fit("ANALYSIS", titleStyle) && measureVectorText(subtitle, s * 0.85, noteStyle) <= innerW && layout.every((row) => fit(row.head, titleStyle));
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
  for (const row of layout) {
    parts.push(`<circle cx="${(box.x + pad + size * 0.35).toFixed(1)}" cy="${(y + size / 2).toFixed(1)}" r="${(size * 0.35).toFixed(1)}" fill="${row.color}" />`);
    parts.push(buildVectorTextMarkup(row.head, box.x + pad + size, y, size, { ...titleStyle, color: row.color, tracking: 0.1 }));
    y += size * 1.45;
    for (const line of row.reason) {
      parts.push(buildVectorTextMarkup(line, box.x + pad + size, y, size * 0.9, reasonStyle));
      y += size * 1.45;
    }
    y += size * 0.45;
  }
  parts.push(buildVectorTextMarkup(footer, box.x + pad, y + size * 0.3, size * 0.8, noteStyle));
  return `<g>${parts.join("")}</g>`;
}

/** "● GOOD  ● NEUTRAL  ● BAD", centered on `cx` in a row `h` tall from `top`. */
function qualityLegend(cx: number, top: number, h: number): string {
  const size = h * 0.42;
  const style: TextStyle = { face: "clear", color: "#c9cfdc", strokeWidth: 0.12, tracking: 0.14 };
  const items = (["good", "neutral", "bad"] as const).map((quality) => ({ quality, label: quality.toUpperCase(), width: size * 1.1 + measureVectorText(quality.toUpperCase(), size, style) }));
  const gap = size * 1.6;
  let x = cx - (items.reduce((sum, item) => sum + item.width, 0) + gap * (items.length - 1)) / 2;
  const y = top + (h - size) / 2;
  return items
    .map(({ quality, label, width }) => {
      const markup = `<circle cx="${(x + size * 0.38).toFixed(1)}" cy="${(y + size / 2).toFixed(1)}" r="${(size * 0.38).toFixed(1)}" fill="${QUALITY_COLORS[quality]}" />${buildVectorTextMarkup(label, x + size * 1.1, y, size, style)}`;
      x += width + gap;
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
 * since yesterday also keeps a grey, struck-through label in the house it
 * left. The birth chart itself
 * stays in the form.
 */
export function buildGocharMarkup(layout: GocharLayout, kundli: KundliData, onDate: string): string {
  const { x0, y0, size, caption, facts, strip } = layout;
  const [year, month, day] = onDate.split("-").map(Number);
  const noon = new Date(Date.UTC(year, month - 1, day, 12));
  const today = gocharKundli(kundli, noon);
  const yesterday = gocharKundli(kundli, new Date(noon.getTime() - 86_400_000));
  const moved = today.planets.some((planet) => yesterday.planets.find((before) => before.name === planet.name)?.sign !== planet.sign);

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
  // where every one is neutral, red where every one is bad; a house with
  // any two different verdicts (or no graha) stays as it is.
  const qualitiesByHouse: GocharQuality[][] = Array.from({ length: 12 }, () => []);
  if (natalMoonSign !== undefined) {
    for (const planet of today.planets) {
      qualitiesByHouse[(planet.sign - today.ascendantSign + 12) % 12].push(gocharQuality(planet.name, allHouses[planet.name], allHouses));
    }
  }
  const houseFill = (i: number) => {
    const qualities = qualitiesByHouse[i];
    if (!qualities.length) return null;
    if (qualities.every((q) => q === "good")) return QUALITY_COLORS.good;
    if (qualities.every((q) => q === "neutral")) return QUALITY_COLORS.neutral;
    if (qualities.every((q) => q === "bad")) return QUALITY_COLORS.bad;
    return null;
  };

  const stroke = Math.max(1.2, size * 0.006);
  const radius = size * 0.02;
  const titleStyle: TextStyle = { face: "clear", color: "#f7c56a", strokeWidth: 0.12, tracking: 0.16 };
  const legendStyle: TextStyle = { face: "clear", color: MOVED_COLOR, strokeWidth: 0.12, tracking: 0.12 };
  // Title: "भाग्य कुन्डली / LUCK CHART" (Devanagari shaped, Latin in the
  // vector font), plus the grey "yesterday" legend when something moved. Devanagari is
  // drawn DEVANAGARI_SCALE larger, on the same baseline as the Latin, so the
  // two read as one line; everything shrinks together to fit the width.
  const latin = " / LUCK CHART";
  const legend = moved ? "  GREY: YESTERDAY" : "";
  const widthAt = (size: number) =>
    layout.titleText.width * size * DEVANAGARI_SCALE + measureVectorText(latin, size, titleStyle) + (legend ? measureVectorText(legend, size, legendStyle) : 0);
  const idealSize = layout.titleHeight * 0.4;
  const textSize = Math.min(idealSize, idealSize * ((caption.w * 0.92) / widthAt(idealSize)));
  const devanagariWidth = layout.titleText.width * textSize * DEVANAGARI_SCALE;
  const latinWidth = measureVectorText(latin, textSize, titleStyle);
  const centerX = caption.x + caption.w / 2;
  const textLeft = centerX - widthAt(textSize) / 2;
  const textTop = caption.y + (layout.titleHeight - textSize) / 2;

  const parts = [
    `<rect x="${caption.x.toFixed(1)}" y="${caption.y.toFixed(1)}" width="${caption.w.toFixed(1)}" height="${(caption.h + stroke).toFixed(1)}" rx="${radius.toFixed(1)}" fill="#080b16" />`,
    devanagariMarkup(layout.titleText, textLeft, textTop + textSize - textSize * DEVANAGARI_SCALE * 0.72, textSize * DEVANAGARI_SCALE, "#f7c56a"),
    buildVectorTextMarkup(latin, textLeft + devanagariWidth, textTop, textSize, titleStyle),
    legend ? buildVectorTextMarkup(legend, textLeft + devanagariWidth + latinWidth, textTop, textSize, legendStyle) : "",
    facts ? devanagariMarkup(facts.text, centerX, caption.y + layout.titleHeight + (caption.h - layout.legendHeight - layout.titleHeight - facts.size) / 2 - facts.size * 0.15, facts.size, PANCHANG_FACTS_COLOR, "center") : "",
    qualityLegend(centerX, caption.y + caption.h - layout.legendHeight, layout.legendHeight),
    kundliChartMarkup(x0, y0, size, today, null, yesterday, colorFor, houseFill, natalMoonSign),
    layout.analysis && natalMoonSign !== undefined ? analysisMarkup(layout.analysis, today.planets.map((p) => p.name), allHouses, natalMoonSign) : "",
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
