import { NatalChart } from "@/lib/astrology/natalChart";
import { meanRahuLongitude } from "@/lib/astrology/gochar";
import { mahadashaOn, vimshottariMahadashas } from "@/lib/astrology/vimshottari";
import { tropicalToSidereal, normalizeDegrees } from "@/lib/astrology/zodiac";
import type { KundliData } from "@/lib/astrologyApi";
import { buildCenteredVectorTextMarkup, measureVectorText, TextStyle } from "./vectorFont";
import { luckMeterTop } from "./luckMeterOverlay";
import { DEVANAGARI_LABELS } from "./devanagariLabels";
import { embedChartSvg } from "./chartSvgOutline";

// The person's birth chart as a North-Indian kundli, drawn opaque just above
// the luck meter, labelled in Nepali like freeastrologyapi.com's Nepali
// chart. Built from the API's planet signs when available (see
// horoscope.ts), else from the app's own natal chart -- the two agree.
// Labels are pre-shaped Devanagari outlines (devanagariLabels.ts) and the
// vector font, never <text>: sharp's rasterizer has no fonts in production.

// Nepali abbreviations, as in the API's Nepali chart.
const NEPALI_LABELS: Record<string, string> = {
  Sun: "सूर्य", Moon: "चं", Mars: "मं", Mercury: "बु", Jupiter: "गु",
  Venus: "शु", Saturn: "श", Rahu: "रा", Ketu: "के",
};
const ASCENDANT_LABEL = "लग्न";

// Label anchors (fractions of the chart's side) for houses 1-12: house 1 is
// the top diamond and houses run counter-clockwise, as in the classic
// North-Indian chart. `num` is where the house's sign number sits, near
// the chart's inner vertices.
const HOUSES: { label: [number, number]; num: [number, number] }[] = [
  { label: [0.5, 0.25], num: [0.5, 0.44] },
  { label: [0.25, 0.1], num: [0.25, 0.2] },
  { label: [0.1, 0.25], num: [0.2, 0.25] },
  { label: [0.25, 0.5], num: [0.44, 0.5] },
  { label: [0.1, 0.75], num: [0.2, 0.75] },
  { label: [0.25, 0.9], num: [0.25, 0.8] },
  { label: [0.5, 0.75], num: [0.5, 0.56] },
  { label: [0.75, 0.9], num: [0.75, 0.8] },
  { label: [0.9, 0.75], num: [0.8, 0.75] },
  { label: [0.75, 0.5], num: [0.56, 0.5] },
  { label: [0.9, 0.25], num: [0.8, 0.25] },
  { label: [0.75, 0.1], num: [0.75, 0.2] },
];

const signOf = (longitude: number) => Math.floor(normalizeDegrees(longitude) / 30) + 1;

/** Same kundli from the app's own (sidereal) natal chart, for when the API isn't available. */
export function kundliFromNatal(natal: NatalChart): KundliData | null {
  if (!natal.ascendant) return null;
  const birth = new Date(natal.birthDateTimeUtc);
  const rahu = tropicalToSidereal(meanRahuLongitude(birth), birth);
  const names = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"] as const;
  return {
    ascendantSign: signOf(natal.ascendant.longitude),
    planets: [
      ...names.map((key) => ({
        name: key[0].toUpperCase() + key.slice(1),
        sign: signOf(natal.planets[key].longitude),
        retro: natal.planets[key].isRetrograde,
      })),
      { name: "Rahu", sign: signOf(rahu), retro: false },
      { name: "Ketu", sign: signOf(rahu + 180), retro: false },
    ],
    mahadashas: vimshottariMahadashas(natal.planets.moon.longitude, birth),
    chartSvg: null,
    source: "local",
  };
}

/**
 * The kundli panel as SVG markup for a `width`x`height` canvas: an opaque
 * square centered horizontally, its bottom just above the luck meter, with
 * the Mahadasha running on `onDate` ("YYYY-MM-DD") in a header strip.
 */
/**
 * The kundli's own box (x0, y0 = top-left, plus its side length and the
 * margin it keeps from other overlays) for a `width`x`height` canvas.
 * Exported so other overlays (the Panchang panel) can align against it
 * without recomputing -- and risking drifting out of sync with -- this
 * geometry themselves.
 */
export function kundliRect(width: number, height: number): { x0: number; y0: number; size: number; gap: number } {
  const minDim = Math.min(width, height);
  const size = Math.round(minDim * 0.26);
  const gap = Math.round(minDim * 0.015);
  const x0 = Math.round((width - size) / 2);
  const y0 = Math.round(luckMeterTop(width, height) - gap - size);
  return { x0, y0, size, gap };
}

export function buildKundliMarkup(width: number, height: number, kundli: KundliData, onDate: string): string {
  const { x0, y0, size } = kundliRect(width, height);
  // Chart only -- the Mahadasha (and any longer reading) stays in the form,
  // keeping the wallpaper uncluttered. `onDate` is kept for callers.
  void onDate;
  return kundliChartMarkup(x0, y0, size, kundli, null);
}

/**
 * The same kundli as a standalone SVG document -- the birth-profile form
 * shows this when freeastrologyapi.com's own chart image isn't available
 * (it lists the Mahadasha in its own text, so no header here).
 */
export function buildKundliSvg(kundli: KundliData, size = 400): string {
  const pad = Math.ceil(size * 0.01);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}">${kundliChartMarkup(0, 0, size, kundli, null)}</svg>`;
}

interface Label {
  text: string; // a DEVANAGARI_LABELS key
  retro: boolean;
  color: string;
}

/** One Nepali label (optionally in retrograde parentheses) centered on `cx`, cap-top at `top`. */
function devanagariLabelMarkup(label: Label, cx: number, top: number, fontSize: number): string {
  const glyph = DEVANAGARI_LABELS[label.text];
  if (!glyph) return "";
  const parenSize = fontSize * 0.62;
  const parenStyle: TextStyle = { color: label.color, strokeWidth: 0.1, tracking: 0 };
  const parenWidth = label.retro ? measureVectorText("(", parenSize, parenStyle) + fontSize * 0.04 : 0;
  const textWidth = glyph.width * fontSize;
  const left = cx - (textWidth + parenWidth * 2) / 2;
  // The shirorekha (headline) sits ~0.7 em above the baseline in Noto Sans Devanagari.
  const baseline = top + fontSize * 0.72;
  const parenTop = top - fontSize * 0.02;
  return [
    label.retro ? buildCenteredVectorTextMarkup("(", left + parenWidth / 2, parenTop, parenSize, parenStyle) : "",
    `<path d="${glyph.d}" fill="${label.color}" transform="translate(${(left + parenWidth).toFixed(1)} ${baseline.toFixed(1)}) scale(${fontSize.toFixed(2)})" />`,
    label.retro ? buildCenteredVectorTextMarkup(")", left + parenWidth + textWidth + parenWidth / 2, parenTop, parenSize, parenStyle) : "",
  ].join("");
}

/** A North-Indian kundli filling the `size`-sided square at (x0, y0), plus the optional Mahadasha header above it. */
function kundliChartMarkup(x0: number, y0: number, size: number, kundli: KundliData, onDate: string | null): string {
  const P = (fx: number, fy: number) => `${(x0 + fx * size).toFixed(1)} ${(y0 + fy * size).toFixed(1)}`;

  const stroke = Math.max(1.2, size * 0.006);
  const lines = [
    `M${P(0, 0)} L${P(1, 1)}`,
    `M${P(1, 0)} L${P(0, 1)}`,
    `M${P(0.5, 0)} L${P(1, 0.5)} L${P(0.5, 1)} L${P(0, 0.5)} Z`,
  ];

  const fontSize = size * 0.072;
  const numberSize = size * 0.032;
  const numberStyle: TextStyle = { color: "#9aa6c8", strokeWidth: 0.14, tracking: 0.1 };

  const byHouse: Label[][] = HOUSES.map(() => []);
  byHouse[0].push({ text: ASCENDANT_LABEL, retro: false, color: "#f7c56a" });
  for (const planet of kundli.planets) {
    const text = NEPALI_LABELS[planet.name];
    if (!text) continue;
    const house = (planet.sign - kundli.ascendantSign + 12) % 12;
    // Nodes always move backwards, so like the API's chart only true
    // planets get the (retrograde) parentheses.
    const retro = planet.retro && planet.name !== "Rahu" && planet.name !== "Ketu";
    byHouse[house].push({ text, retro, color: "#fdf6e6" });
  }

  const labels = byHouse
    .map((entries, i) => {
      const [fx, fy] = HOUSES[i].label;
      const lineHeight = fontSize * 1.08;
      const top = y0 + fy * size - (entries.length * lineHeight) / 2 + fontSize * 0.05;
      return entries.map((entry, row) => devanagariLabelMarkup(entry, x0 + fx * size, top + row * lineHeight, fontSize)).join("");
    })
    .join("");

  const numbers = HOUSES.map(({ num: [fx, fy] }, i) => {
    const sign = ((kundli.ascendantSign - 1 + i) % 12) + 1;
    return buildCenteredVectorTextMarkup(String(sign), x0 + fx * size, y0 + fy * size - numberSize / 2, numberSize, numberStyle);
  }).join("");

  // Header strip: "CURRENT MAHADASHA" over e.g. "SUN (2023-2029)".
  const dasha = onDate ? mahadashaOn(kundli.mahadashas, onDate) : null;
  const headerHeight = dasha ? size * 0.2 : 0;
  let header = "";
  if (dasha) {
    const titleStyle: TextStyle = { color: "#b8b2a4", strokeWidth: 0.12, tracking: 0.22 };
    const valueStyle: TextStyle = { color: "#f7c56a", strokeWidth: 0.13, tracking: 0.14 };
    const value = `${dasha.lord} (${dasha.start.slice(0, 4)}-${dasha.end.slice(0, 4)})`.toUpperCase();
    const fit = (text: string, ideal: number, style: TextStyle) => Math.min(ideal, ideal * ((size * 0.9) / measureVectorText(text, ideal, style)));
    const titleSize = fit("CURRENT MAHADASHA", size * 0.036, titleStyle);
    const valueSize = fit(value, size * 0.052, valueStyle);
    const top = y0 - headerHeight;
    header =
      buildCenteredVectorTextMarkup("CURRENT MAHADASHA", x0 + size / 2, top + headerHeight * 0.18, titleSize, titleStyle) +
      buildCenteredVectorTextMarkup(value, x0 + size / 2, top + headerHeight * 0.48, valueSize, valueStyle);
  }

  const backdrop = `<rect x="${x0 - stroke}" y="${y0 - headerHeight - stroke}" width="${size + stroke * 2}" height="${size + headerHeight + stroke * 2}" rx="${(size * 0.02).toFixed(1)}" fill="#080b16" />`;

  // The API's own chart when we have it: pasted as-is ("snapshot and
  // paste"), so the wallpaper matches the form's chart exactly.
  if (kundli.chartSvg) {
    return `<g>${backdrop}${header}${embedChartSvg(kundli.chartSvg, x0, y0, size)}</g>`;
  }

  return `
  <g>
    ${backdrop}
    ${header}
    <rect x="${x0}" y="${y0}" width="${size}" height="${size}" fill="none" stroke="#f7c56a" stroke-width="${stroke.toFixed(1)}" />
    <path d="${lines.join(" ")}" fill="none" stroke="#f7c56a" stroke-opacity="0.85" stroke-width="${stroke.toFixed(1)}" />
    ${numbers}
    ${labels}
  </g>`;
}
