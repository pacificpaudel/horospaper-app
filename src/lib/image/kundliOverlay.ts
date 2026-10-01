import { NatalChart } from "@/lib/astrology/natalChart";
import { meanRahuLongitude } from "@/lib/astrology/gochar";
import { mahadashaOn, vimshottariMahadashas } from "@/lib/astrology/vimshottari";
import { tropicalToSidereal, normalizeDegrees } from "@/lib/astrology/zodiac";
import type { KundliData } from "@/lib/astrologyApi";
import { getPlanetPosition } from "@/lib/astrology/ephemeris";
import type { PlanetKey } from "@/lib/astrology/constants";
import { buildCenteredVectorTextMarkup, measureVectorText, TextStyle } from "./vectorFont";
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
  { label: [0.25, 0.115], num: [0.25, 0.2] },
  { label: [0.1, 0.25], num: [0.2, 0.25] },
  { label: [0.25, 0.5], num: [0.44, 0.5] },
  { label: [0.1, 0.75], num: [0.2, 0.75] },
  { label: [0.25, 0.9], num: [0.25, 0.8] },
  { label: [0.5, 0.75], num: [0.5, 0.56] },
  { label: [0.75, 0.9], num: [0.75, 0.8] },
  { label: [0.9, 0.75], num: [0.8, 0.75] },
  { label: [0.75, 0.5], num: [0.56, 0.5] },
  { label: [0.9, 0.25], num: [0.8, 0.25] },
  { label: [0.75, 0.115], num: [0.75, 0.2] },
];

// Where each house's numbered house icon sits (fractions of the chart's
// side), houses 1-12: in the upper part of each section where it's wide
// enough. Houses 6 and 8 (the bottom triangles) narrow to a point at the
// top, where their rashi number already sits, so theirs go in the lower
// outer corner instead; house 7's top is likewise taken by its rashi.
// Each house's outline (fractions of the chart's side), houses 1-12: the
// top diamond is house 1, then counter-clockwise.
const HOUSE_POLYGONS: [number, number][][] = [
  [[0.5, 0], [0.75, 0.25], [0.5, 0.5], [0.25, 0.25]],
  [[0, 0], [0.5, 0], [0.25, 0.25]],
  [[0, 0], [0.25, 0.25], [0, 0.5]],
  [[0, 0.5], [0.25, 0.25], [0.5, 0.5], [0.25, 0.75]],
  [[0, 0.5], [0.25, 0.75], [0, 1]],
  [[0, 1], [0.25, 0.75], [0.5, 1]],
  [[0.5, 1], [0.25, 0.75], [0.5, 0.5], [0.75, 0.75]],
  [[0.5, 1], [0.75, 0.75], [1, 1]],
  [[1, 1], [0.75, 0.75], [1, 0.5]],
  [[1, 0.5], [0.75, 0.75], [0.5, 0.5], [0.75, 0.25]],
  [[1, 0.5], [0.75, 0.25], [1, 0]],
  [[1, 0], [0.75, 0.25], [0.5, 0]],
];

const ICON_H = 0.07;
const HOUSE_ICONS: [number, number][] = [
  [0.5, 0.06],
  [0.25, 0.045],
  [0.045, 0.15],
  [0.25, 0.33],
  [0.045, 0.65],
  [0.1, 0.955],
  [0.5, 0.64],
  [0.9, 0.955],
  [0.955, 0.65],
  [0.75, 0.33],
  [0.955, 0.15],
  [0.75, 0.045],
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

/** Where a graha was yesterday, before it changed sign (see gocharOverlay.ts). */
export const MOVED_COLOR = "#a9b1c4";

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
  /** The graha's English name (absent for the lagna label). */
  planet?: string;
}

/** One Nepali label (optionally in retrograde parentheses) centered on `cx`, cap-top at `top`. */
/** Houses 2, 6, 8 and 12 (0-based): triangles wide enough to set labels side by side. */
const WIDE_HOUSES = new Set([1, 5, 7, 11]);

/** A label's drawn width, including retrograde parentheses -- matches devanagariLabelMarkup. */
function labelWidth(label: Label, fontSize: number): number {
  const glyph = DEVANAGARI_LABELS[label.text];
  if (!glyph) return 0;
  const parenWidth = label.retro ? measureVectorText("(", fontSize * 0.62, { strokeWidth: 0.1, tracking: 0 }) + fontSize * 0.04 : 0;
  return glyph.width * fontSize + parenWidth * 2;
}

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
export function kundliChartMarkup(
  x0: number,
  y0: number,
  size: number,
  kundli: KundliData,
  onDate: string | null,
  previous?: KundliData,
  /** Each graha label's colour (by English name); white when not given. */
  colorFor?: (planetName: string) => string,
  /** A background tint for house i (0-based, house 1 = 0), or null for none. */
  houseFill?: (houseIndex: number) => string | null
): string {
  const P = (fx: number, fy: number) => `${(x0 + fx * size).toFixed(1)} ${(y0 + fy * size).toFixed(1)}`;

  const stroke = Math.max(1.2, size * 0.006);
  const lines = [
    `M${P(0, 0)} L${P(1, 1)}`,
    `M${P(1, 0)} L${P(0, 1)}`,
    `M${P(0.5, 0)} L${P(1, 0.5)} L${P(0.5, 1)} L${P(0, 0.5)} Z`,
  ];

  const houseTints = houseFill
    ? HOUSE_POLYGONS.map((corners, i) => {
        const fill = houseFill(i);
        return fill ? `<path d="M${corners.map(([fx, fy]) => P(fx, fy)).join(" L")} Z" fill="${fill}" fill-opacity="0.3" />` : "";
      }).join("")
    : "";

  const fontSize = size * 0.072;
  const numberSize = size * 0.03;
  const numberStyle: TextStyle = { color: "#f7c56a", strokeWidth: 0.15, tracking: 0.06 };
  const houseNumberStyle: TextStyle = { color: "#e6e9f0", strokeWidth: 0.16, tracking: 0.06 };

  const byHouse: Label[][] = HOUSES.map(() => []);
  byHouse[0].push({ text: ASCENDANT_LABEL, retro: false, color: "#f7c56a" });
  for (const planet of kundli.planets) {
    const text = NEPALI_LABELS[planet.name];
    if (!text) continue;
    const house = (planet.sign - kundli.ascendantSign + 12) % 12;
    // Nodes always move backwards, so like the API's chart only true
    // planets get the (retrograde) parentheses.
    const retro = planet.retro && planet.name !== "Rahu" && planet.name !== "Ketu";
    byHouse[house].push({ text, retro, color: colorFor?.(planet.name) ?? "#fdf6e6", planet: planet.name });
  }
  for (const before of previous?.planets ?? []) {
    const text = NEPALI_LABELS[before.name];
    const now = kundli.planets.find((planet) => planet.name === before.name);
    if (!text || !now || now.sign === before.sign) continue;
    byHouse[(before.sign - kundli.ascendantSign + 12) % 12].push({ text, retro: false, color: MOVED_COLOR, struck: true, planet: before.name });
  }

  // Each label's center, so a moved graha can be joined to where it was.
  const centers = new Map<string, [number, number]>();
  const labels = byHouse
    .map((entries, i) => {
      const [fx, fy] = HOUSES[i].label;
      const lineHeight = fontSize * 1.08;
      // Never above the house's own icon when that sits over the labels.
      const iconFy = HOUSE_ICONS[i][1];
      const belowIcon = iconFy < fy ? y0 + (iconFy + ICON_H / 2 + 0.008) * size : -Infinity;
      // The wide, shallow triangles (houses 2, 6, 8, 12) put labels side by
      // side, two to a row; the others stack them one per line.
      const perRow = WIDE_HOUSES.has(i) ? 2 : 1;
      const rows: Label[][] = [];
      for (let k = 0; k < entries.length; k += perRow) rows.push(entries.slice(k, k + perRow));
      const top = Math.max(y0 + fy * size - (rows.length * lineHeight) / 2 + fontSize * 0.05, belowIcon);
      return rows
        .map((rowEntries, row) => {
          const widths = rowEntries.map((entry) => labelWidth(entry, fontSize));
          const gap = fontSize * 0.45;
          let x = x0 + fx * size - (widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1)) / 2;
          return rowEntries
            .map((entry, k) => {
              const cx = x + widths[k] / 2;
              x += widths[k] + gap;
              const y = top + row * lineHeight;
              if (entry.planet) centers.set(`${entry.planet}:${entry.struck ? "was" : "now"}`, [cx, y + fontSize * 0.45]);
              return devanagariLabelMarkup(entry, cx, y, fontSize);
            })
            .join("");
        })
        .join("");
    })
    .join("");

  // A red dashed line from where each moved graha was yesterday to where it
  // is now, ending in an arrowhead and a red ring around its new label.
  const moves = [...centers.entries()]
    .filter(([key]) => key.endsWith(":was"))
    .map(([key, [wx, wy]]) => {
      const now = centers.get(key.replace(/:was$/, ":now"));
      if (!now) return "";
      const [nx, ny] = now;
      const ringR = fontSize * 0.75;
      const dist = Math.hypot(nx - wx, ny - wy);
      if (dist < ringR * 2) return "";
      const ux = (nx - wx) / dist;
      const uy = (ny - wy) / dist;
      const sx = wx + ux * fontSize * 0.7;
      const sy = wy + uy * fontSize * 0.7;
      const ex = nx - ux * ringR;
      const ey = ny - uy * ringR;
      const head = fontSize * 0.35;
      const lineWidth = Math.max(1.2, fontSize * 0.08);
      return `
    <line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${MOVED_COLOR}" stroke-width="${lineWidth.toFixed(1)}" stroke-dasharray="${(fontSize * 0.3).toFixed(1)} ${(fontSize * 0.2).toFixed(1)}" stroke-linecap="round" />
    <path d="M${ex.toFixed(1)} ${ey.toFixed(1)} L${(ex - ux * head - uy * head * 0.6).toFixed(1)} ${(ey - uy * head + ux * head * 0.6).toFixed(1)} L${(ex - ux * head + uy * head * 0.6).toFixed(1)} ${(ey - uy * head - ux * head * 0.6).toFixed(1)} Z" fill="${MOVED_COLOR}" />
    <circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="${ringR.toFixed(1)}" fill="none" stroke="${MOVED_COLOR}" stroke-width="${lineWidth.toFixed(1)}" />`;
    })
    .join("");

  // Rashi (sign) number of each house, in a gold circle near the chart's
  // center, where the North-Indian chart traditionally writes it.
  const circleR = size * 0.03;
  const lineW = Math.max(1, size * 0.004);
  const numbers = HOUSES.map(({ num: [fx, fy] }, i) => {
    const sign = ((kundli.ascendantSign - 1 + i) % 12) + 1;
    const cx = x0 + fx * size;
    const cy = y0 + fy * size;
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${circleR.toFixed(1)}" fill="#080b16" stroke="#f7c56a" stroke-width="${lineW.toFixed(1)}" />${buildCenteredVectorTextMarkup(String(sign), cx, cy - numberSize / 2, numberSize, numberStyle)}`;
  }).join("");

  // House number of each house, in a small house-shaped icon in its own
  // section (house 1 is always the top diamond, counter-clockwise from there).
  const iconW = size * 0.068;
  const iconH = size * ICON_H;
  const roofH = iconH * 0.42;
  const houseNumberSize = size * 0.029;
  const houseIcons = HOUSE_ICONS.map(([fx, fy], i) => {
    const cx = x0 + fx * size;
    const top = y0 + fy * size - iconH / 2;
    const left = (cx - iconW / 2).toFixed(1);
    const right = (cx + iconW / 2).toFixed(1);
    const eave = top + roofH;
    const bottom = top + iconH;
    const shape = `M${cx.toFixed(1)} ${top.toFixed(1)} L${right} ${eave.toFixed(1)} L${right} ${bottom.toFixed(1)} L${left} ${bottom.toFixed(1)} L${left} ${eave.toFixed(1)} Z`;
    return `<path d="${shape}" fill="#080b16" stroke="#c9cfdc" stroke-width="${lineW.toFixed(1)}" stroke-linejoin="round" />${buildCenteredVectorTextMarkup(String(i + 1), cx, (eave + bottom) / 2 - houseNumberSize / 2, houseNumberSize, houseNumberStyle)}`;
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
    ${houseTints}
    <path d="${lines.join(" ")}" fill="none" stroke="#f7c56a" stroke-opacity="0.85" stroke-width="${stroke.toFixed(1)}" />
    ${houseIcons}
    ${numbers}
    ${labels}
    ${moves}
  </g>`;
}
