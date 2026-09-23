import { NatalChart } from "@/lib/astrology/natalChart";
import { meanRahuLongitude } from "@/lib/astrology/gochar";
import { tropicalToSidereal, normalizeDegrees } from "@/lib/astrology/zodiac";
import type { KundliData } from "@/lib/astrologyApi";
import { buildCenteredVectorTextMarkup, TextStyle } from "./vectorFont";
import { luckMeterTop } from "./luckMeterOverlay";

// The person's birth chart as a North-Indian kundli, drawn opaque just above
// the luck meter. Built from freeastrologyapi.com's planet signs when
// available (see horoscope.ts), else from the app's own natal chart -- the
// two agree. Drawn with the vector font rather than embedding the API's own
// SVG: that SVG is text-based, and sharp's rasterizer has no fonts in
// production, so its labels would come out as empty boxes.

const ABBREVIATIONS: Record<string, string> = {
  Sun: "SU", Moon: "MO", Mars: "MA", Mercury: "ME", Jupiter: "JU",
  Venus: "VE", Saturn: "SA", Rahu: "RA", Ketu: "KE",
};

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
    source: "local",
  };
}

/**
 * The kundli panel as SVG markup for a `width`x`height` canvas: an opaque
 * square centered horizontally, its bottom just above the luck meter.
 */
export function buildKundliMarkup(width: number, height: number, kundli: KundliData): string {
  const minDim = Math.min(width, height);
  const size = Math.round(minDim * 0.26);
  const gap = Math.round(minDim * 0.015);
  const x0 = Math.round((width - size) / 2);
  const y0 = Math.round(luckMeterTop(width, height) - gap - size);
  const P = (fx: number, fy: number) => `${(x0 + fx * size).toFixed(1)} ${(y0 + fy * size).toFixed(1)}`;

  const stroke = Math.max(1.2, size * 0.006);
  const lines = [
    `M${P(0, 0)} L${P(1, 1)}`,
    `M${P(1, 0)} L${P(0, 1)}`,
    `M${P(0.5, 0)} L${P(1, 0.5)} L${P(0.5, 1)} L${P(0, 0.5)} Z`,
  ];

  const labelSize = size * 0.05;
  const numberSize = size * 0.032;
  const planetStyle: TextStyle = { color: "#fdf6e6", strokeWidth: 0.12, tracking: 0.12 };
  const ascStyle: TextStyle = { color: "#f7c56a", strokeWidth: 0.14, tracking: 0.12 };
  const numberStyle: TextStyle = { color: "#9aa6c8", strokeWidth: 0.14, tracking: 0.1 };

  const byHouse: { text: string; style: TextStyle }[][] = HOUSES.map(() => []);
  byHouse[0].push({ text: "AS", style: ascStyle });
  for (const planet of kundli.planets) {
    const abbreviation = ABBREVIATIONS[planet.name];
    if (!abbreviation) continue;
    const house = (planet.sign - kundli.ascendantSign + 12) % 12;
    // Nodes always move backwards, so like the API's chart only true
    // planets get the (retrograde) parentheses.
    const retro = planet.retro && planet.name !== "Rahu" && planet.name !== "Ketu";
    byHouse[house].push({ text: retro ? `(${abbreviation})` : abbreviation, style: planetStyle });
  }

  const labels = byHouse
    .map((entries, i) => {
      const [fx, fy] = HOUSES[i].label;
      const lineHeight = labelSize * 1.45;
      const top = y0 + fy * size - (entries.length * lineHeight - (lineHeight - labelSize)) / 2;
      return entries
        .map((entry, row) => buildCenteredVectorTextMarkup(entry.text, x0 + fx * size, top + row * lineHeight, labelSize, entry.style))
        .join("");
    })
    .join("");

  const numbers = HOUSES.map(({ num: [fx, fy] }, i) => {
    const sign = ((kundli.ascendantSign - 1 + i) % 12) + 1;
    return buildCenteredVectorTextMarkup(String(sign), x0 + fx * size, y0 + fy * size - numberSize / 2, numberSize, numberStyle);
  }).join("");

  return `
  <g>
    <rect x="${x0 - stroke}" y="${y0 - stroke}" width="${size + stroke * 2}" height="${size + stroke * 2}" rx="${(size * 0.02).toFixed(1)}" fill="#080b16" />
    <rect x="${x0}" y="${y0}" width="${size}" height="${size}" fill="none" stroke="#f7c56a" stroke-width="${stroke.toFixed(1)}" />
    <path d="${lines.join(" ")}" fill="none" stroke="#f7c56a" stroke-opacity="0.85" stroke-width="${stroke.toFixed(1)}" />
    ${numbers}
    ${labels}
  </g>`;
}
