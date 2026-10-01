import type { KundliData } from "@/lib/astrologyApi";
import { gocharKundli, kundliChartMarkup, MOVED_COLOR } from "./kundliOverlay";
import { devanagariMarkup, PANCHANG_FACTS_COLOR, PANCHANG_SUMMARY_COLOR } from "./panchangOverlay";
import { buildVectorTextMarkup, measureVectorText, TextStyle } from "./vectorFont";
import { gocharQuality, GocharQuality } from "@/lib/astrology/gochar";
import type { GocharLayout } from "./wallpaperLayout";

const DEVANAGARI_SCALE = 1.55;

/** Good / neutral / bad transit colours (gocharQuality). */
const QUALITY_COLORS: Record<GocharQuality, string> = {
  good: "#3ecf6e",
  neutral: "#c08a50",
  bad: "#ff4d4d",
};

/** "● GOOD  ● NEUTRAL  ● BAD", centered on `cx` in a row `h` tall from `top`. */
function qualityLegend(cx: number, top: number, h: number): string {
  const size = h * 0.42;
  const style: TextStyle = { color: "#c9cfdc", strokeWidth: 0.12, tracking: 0.14 };
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

  const stroke = Math.max(1.2, size * 0.006);
  const radius = size * 0.02;
  const titleStyle: TextStyle = { color: "#f7c56a", strokeWidth: 0.12, tracking: 0.16 };
  const legendStyle: TextStyle = { color: MOVED_COLOR, strokeWidth: 0.12, tracking: 0.12 };
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
    kundliChartMarkup(x0, y0, size, today, null, yesterday, colorFor),
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
