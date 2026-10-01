import { NatalChart } from "@/lib/astrology/natalChart";
import { meanRahuLongitude } from "@/lib/astrology/gochar";
import { mahadashaOn, vimshottariMahadashas } from "@/lib/astrology/vimshottari";
import { tropicalToSidereal, normalizeDegrees } from "@/lib/astrology/zodiac";
import type { KundliData } from "@/lib/astrologyApi";
import { getPlanetPosition } from "@/lib/astrology/ephemeris";
import type { PlanetKey } from "@/lib/astrology/constants";
import { buildCenteredVectorTextMarkup, buildVectorTextMarkup, measureVectorText, TextStyle } from "./vectorFont";
import { devanagariMarkup, PANCHANG_FACTS_COLOR, PANCHANG_SUMMARY_COLOR } from "./panchangOverlay";
import type { GocharLayout } from "./wallpaperLayout";
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

const MOVED_COLOR = "#ff4d4d";

const GOCHAR_PLANETS: { name: string; key: PlanetKey }[] = [
  { name: "Sun", key: "sun" },
  { name: "Moon", key: "moon" },
  { name: "Mars", key: "mars" },
  { name: "Mercury", key: "mercury" },
  { name: "Jupiter", key: "jupiter" },
  { name: "Venus", key: "venus" },
  { name: "Saturn", key: "saturn" },
];

/**
 * Today's gochar (transit) chart on the person's own kundli: the same
 * lagna, so the same houses and sign numbers as their birth chart, with
 * the grahas placed by where they actually are at `at` (sidereal).
 */
export function gocharKundli(natal: KundliData, at: Date): KundliData {
  const rahu = tropicalToSidereal(meanRahuLongitude(at), at);
  return {
    ascendantSign: natal.ascendantSign,
    planets: [
      ...GOCHAR_PLANETS.map(({ name, key }) => {
        const position = getPlanetPosition(key, at);
        return { name, sign: signOf(tropicalToSidereal(position.longitude, at)), retro: position.isRetrograde };
      }),
      { name: "Rahu", sign: signOf(rahu), retro: false },
      { name: "Ketu", sign: signOf(rahu + 180), retro: false },
    ],
    mahadashas: null,
    chartSvg: null,
    source: "local",
  };
}

/**
 * The wallpaper's gochar block, into the boxes wallpaperLayout.ts placed:
 * a "TODAY'S GOCHAR" caption with the day's Panchang facts on one line
 * under it, the chart, and the Panchang prediction as a strip below.
 * The chart is today's gochar on the person's lagna (see gocharKundli),
 * judged at noon UTC of `onDate` ("YYYY-MM-DD") like the day's gochar
 * reading; any graha that changed sign since yesterday also keeps a red,
 * struck-through label in the house it left. The birth chart itself
 * stays in the form.
 */
export function buildGocharMarkup(layout: GocharLayout, kundli: KundliData, onDate: string): string {
  const { x0, y0, size, caption, facts, strip } = layout;
  const [year, month, day] = onDate.split("-").map(Number);
  const noon = new Date(Date.UTC(year, month - 1, day, 12));
  const today = gocharKundli(kundli, noon);
  const yesterday = gocharKundli(kundli, new Date(noon.getTime() - 86_400_000));
  const moved = today.planets.some((planet) => yesterday.planets.find((before) => before.name === planet.name)?.sign !== planet.sign);

  const stroke = Math.max(1.2, size * 0.006);
  const radius = size * 0.02;
  const titleStyle: TextStyle = { color: "#f7c56a", strokeWidth: 0.12, tracking: 0.16 };
  const legendStyle: TextStyle = { color: MOVED_COLOR, strokeWidth: 0.12, tracking: 0.12 };
  const title = "TODAY'S GOCHAR";
  const legend = moved ? "  RED: YESTERDAY" : "";
  const idealSize = layout.titleHeight * 0.45;
  const fullWidth = measureVectorText(title, idealSize, titleStyle) + (legend ? measureVectorText(legend, idealSize, legendStyle) : 0);
  const textSize = Math.min(idealSize, idealSize * ((caption.w * 0.92) / fullWidth));
  const titleWidth = measureVectorText(title, textSize, titleStyle);
  const legendWidth = legend ? measureVectorText(legend, textSize, legendStyle) : 0;
  const centerX = caption.x + caption.w / 2;
  const textLeft = centerX - (titleWidth + legendWidth) / 2;
  const textTop = caption.y + (layout.titleHeight - textSize) / 2;

  const parts = [
    `<rect x="${caption.x.toFixed(1)}" y="${caption.y.toFixed(1)}" width="${caption.w.toFixed(1)}" height="${(caption.h + stroke).toFixed(1)}" rx="${radius.toFixed(1)}" fill="#080b16" />`,
    buildVectorTextMarkup(title, textLeft, textTop, textSize, titleStyle),
    legend ? buildVectorTextMarkup(legend, textLeft + titleWidth, textTop, textSize, legendStyle) : "",
    facts ? devanagariMarkup(facts.text, centerX, caption.y + layout.titleHeight + (caption.h - layout.titleHeight - facts.size) / 2 - facts.size * 0.15, facts.size, PANCHANG_FACTS_COLOR, "center") : "",
    kundliChartMarkup(x0, y0, size, today, null, yesterday),
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
  /** Drawn struck through: where a graha was yesterday, before it moved. */
  struck?: boolean;
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
    label.struck
      ? `<line x1="${(left - fontSize * 0.12).toFixed(1)}" y1="${(top + fontSize * 0.45).toFixed(1)}" x2="${(left + textWidth + parenWidth * 2 + fontSize * 0.12).toFixed(1)}" y2="${(top + fontSize * 0.45).toFixed(1)}" stroke="${label.color}" stroke-width="${(fontSize * 0.1).toFixed(1)}" stroke-linecap="round" />`
      : "",
  ].join("");
}

/**
 * A North-Indian kundli filling the `size`-sided square at (x0, y0), plus
 * the optional Mahadasha header above it. With `previous` (the same chart
 * a day earlier), each graha whose sign changed also gets a red,
 * struck-through label in the house it was in.
 */
function kundliChartMarkup(x0: number, y0: number, size: number, kundli: KundliData, onDate: string | null, previous?: KundliData): string {
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
  for (const before of previous?.planets ?? []) {
    const text = NEPALI_LABELS[before.name];
    const now = kundli.planets.find((planet) => planet.name === before.name);
    if (!text || !now || now.sign === before.sign) continue;
    byHouse[(before.sign - kundli.ascendantSign + 12) % 12].push({ text, retro: false, color: MOVED_COLOR, struck: true });
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
