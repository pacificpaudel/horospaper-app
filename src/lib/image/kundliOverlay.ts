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
import { fittedPlanetBodyMarkup, PLANET_BODY_EXTENT, planetBodyFor } from "./planetBodies";
import { ZODIAC_COLORS, ZODIAC_SIGNS, zodiacIconMarkup } from "./zodiacIcons";

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

// The Luck Chart's layout (fractions of the chart's side), houses 1-12: its
// three numbers -- house icon, rashi number, count from the natal Moon --
// each in a different corner of the house. The rashi stays by the inner
// corner, where the North-Indian chart traditionally writes it. Triangles:
// the icon in the chart-corner end, the Moon count in the end at the middle
// of the chart's edge. Diamonds: the icon in the outer corner, the Moon
// count in one side corner (turning with the house: left, bottom, right, top).
const LUCK_LAYOUT: { icon: [number, number]; sign: [number, number]; moon: [number, number] }[] = [
  { icon: [0.5, 0.075], sign: [0.5, 0.42], moon: [0.355, 0.25] },
  { icon: [0.135, 0.045], sign: [0.25, 0.2], moon: [0.365, 0.045] },
  { icon: [0.045, 0.135], sign: [0.2, 0.25], moon: [0.045, 0.365] },
  { icon: [0.075, 0.5], sign: [0.42, 0.5], moon: [0.25, 0.645] },
  { icon: [0.045, 0.865], sign: [0.2, 0.75], moon: [0.045, 0.635] },
  { icon: [0.135, 0.955], sign: [0.25, 0.8], moon: [0.365, 0.955] },
  { icon: [0.5, 0.925], sign: [0.5, 0.58], moon: [0.645, 0.75] },
  { icon: [0.865, 0.955], sign: [0.75, 0.8], moon: [0.635, 0.955] },
  { icon: [0.955, 0.865], sign: [0.8, 0.75], moon: [0.955, 0.635] },
  { icon: [0.925, 0.5], sign: [0.58, 0.5], moon: [0.75, 0.355] },
  { icon: [0.955, 0.135], sign: [0.8, 0.25], moon: [0.955, 0.365] },
  { icon: [0.865, 0.045], sign: [0.75, 0.2], moon: [0.635, 0.045] },
];
/** How much larger the Luck Chart draws its three numbers than the birth chart. */
const LUCK_NUMBER_SCALE = 1.3;
/** The same in the full-screen view, where the chart itself is large: smaller, to leave the houses room. */
const ZOOM_NUMBER_SCALE = 0.8;

/** Background of the count-from-Moon circles (Luck Chart only). */
export const MOON_COUNT_COLOR = "#2fa95a";

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

/** Where a graha last was, before it changed sign (see gocharOverlay.ts). */
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
export function buildKundliSvg(kundli: KundliData, size = 400, moonIllumination = 0.5): string {
  const pad = Math.ceil(size * 0.01);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}">${kundliChartMarkup(0, 0, size, kundli, null, undefined, undefined, undefined, undefined, undefined, false, moonIllumination, true)}</svg>`;
}

interface Label {
  text: string; // a DEVANAGARI_LABELS key
  retro: boolean;
  color: string;
  /** Drawn struck through: where a graha last was, before it moved. */
  struck?: boolean;
  /** The graha's English name (absent for the lagna label). */
  planet?: string;
  /** Luck Chart only: the graha's stay in this sign so far, in days, of its whole stay there. */
  stay?: SignStay;
  /** Zoomed Luck Chart only: the height of the graha's figure drawn before its name. */
  icon?: number;
}

/** How long a graha has been in its current sign (`elapsed` days) out of its whole stay (`total` days). */
export interface SignStay {
  elapsed: number;
  total: number;
}

// The stay pie after a graha's label: green for the days it has already
// spent in the sign, red for the days it has left there -- so it reads as
// how far through this house the graha is, and how soon it moves on.
const STAY_GOOD = "#1aff5c";
const STAY_LEFT = "#ff2020";
// Pie diameter as a share of the label's font size: small on the wallpaper
// (just readable), large enough in the zoomed view to hold its percentages.
const PIE_SCALE = 0.5;
const ZOOM_PIE_SCALE = 1.6;
const PIE_GAP = 0.1;
// Zoomed, clear of the ring drawn around a just-moved graha's name.
const ZOOM_PIE_GAP = 0.4;
const pieGapFor = (zoom: boolean) => (zoom ? ZOOM_PIE_GAP : PIE_GAP);
const pieScaleFor = (zoom: boolean) => (zoom ? ZOOM_PIE_SCALE : PIE_SCALE);
const stayWidth = (label: Label, fontSize: number, zoom: boolean) => (label.stay ? fontSize * (pieGapFor(zoom) + pieScaleFor(zoom)) : 0);

// The zoomed view's graha figure before each name: between these shares of
// the font size tall, as large as the house has room for.
const ICON_MIN = 0.8;
const ICON_MAX = 1.5;
// Clear of the ring drawn around a just-moved graha's name.
const ICON_GAP = 0.4;
/** A figure's width per unit of its height (wider for the Sun's rays and Saturn's ring). */
const iconAspect = (planet: string) => {
  const body = planetBodyFor(planet);
  return body ? PLANET_BODY_EXTENT[body].wide / PLANET_BODY_EXTENT[body].tall : 0;
};
/** The figure's width plus its gap to the name, or 0 without one. */
const iconWidth = (label: Label, fontSize: number) => (label.icon && label.planet ? label.icon * iconAspect(label.planet) + fontSize * ICON_GAP : 0);

/**
 * A pie of radius r at (cx, cy): `share` (0-1) of it green from 12 o'clock
 * clockwise, the rest red. With `withPercents`, each slice also carries
 * its share as a whole percentage (the full 360° = 100%).
 */
export function stayPieMarkup(cx: number, cy: number, r: number, share: number, withPercents = false): string {
  const s = Math.min(1, Math.max(0, share));
  const outline = `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="#080b16" stroke-width="${(r * 0.12).toFixed(2)}" />`;
  const parts: string[] = [];
  if (s <= 0.001 || s >= 0.999) {
    parts.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${s >= 0.999 ? STAY_GOOD : STAY_LEFT}" />`);
  } else {
    const angle = s * 2 * Math.PI;
    const ex = cx + r * Math.sin(angle);
    const ey = cy - r * Math.cos(angle);
    const large = s > 0.5 ? 1 : 0;
    parts.push(
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${STAY_LEFT}" />`,
      `<path d="M${cx.toFixed(1)} ${cy.toFixed(1)} L${cx.toFixed(1)} ${(cy - r).toFixed(1)} A${r.toFixed(1)} ${r.toFixed(1)} 0 ${large} 1 ${ex.toFixed(1)} ${ey.toFixed(1)} Z" fill="${STAY_GOOD}" />`
    );
  }
  parts.push(outline);
  if (withPercents) {
    // Each slice's share of the whole circle (360° = 100%), written on it in
    // white with a dark halo -- readable on green, on red, or straddling the
    // edge of a thin slice. The two numbers sit half a radius out along
    // their slices' middles, which keeps them a full radius apart.
    const passed = Math.round(s * 100);
    const slices = [
      { percent: passed, mid: s * Math.PI },
      { percent: 100 - passed, mid: s * 2 * Math.PI + (1 - s) * Math.PI },
    ].filter((slice) => slice.percent > 0);
    const textSize = r * (slices.length === 1 ? 0.62 : 0.5);
    for (const slice of slices) {
      const dist = slices.length === 1 ? 0 : r * 0.5;
      const tx = cx + dist * Math.sin(slice.mid);
      const top = cy - dist * Math.cos(slice.mid) - textSize / 2;
      const text = String(slice.percent);
      parts.push(
        buildCenteredVectorTextMarkup(text, tx, top, textSize, { face: "clear", color: "#05070f", strokeWidth: 0.42, tracking: 0 }),
        buildCenteredVectorTextMarkup(text, tx, top, textSize, { face: "clear", color: "#ffffff", strokeWidth: 0.17, tracking: 0 })
      );
    }
  }
  return parts.join("");
}

/** One Nepali label (optionally in retrograde parentheses) centered on `cx`, cap-top at `top`. */
/** Houses 2, 6, 8 and 12 (0-based): triangles wide enough to set labels side by side. */
const WIDE_HOUSES = new Set([1, 5, 7, 11]);
/** Houses 3, 5, 9 and 11 (0-based): the tall, narrow side triangles, split top/bottom rather than left/right. */
const SIDE_HOUSES = new Set([2, 4, 8, 10]);

/** Where `polygon` spans along the other axis, on the line where coordinate `axis` equals `v`. */
function spanAt(polygon: [number, number][], axis: 0 | 1, v: number): [number, number] {
  const hits: number[] = [];
  polygon.forEach((a, k) => {
    const b = polygon[(k + 1) % polygon.length];
    if (a[axis] === b[axis] || (a[axis] - v) * (b[axis] - v) > 0) return;
    const t = (v - a[axis]) / (b[axis] - a[axis]);
    hits.push(a[1 - axis] + t * (b[1 - axis] - a[1 - axis]));
  });
  return [Math.min(...hits), Math.max(...hits)];
}

/**
 * House i's inscribed circle (fractions of the side): the largest circle
 * that fits it -- the diamonds' is much larger than the triangles'. Both
 * shapes are tangential, so the radius is 2 * area / perimeter; the center
 * is the incenter (triangles) or the middle (diamonds).
 */
function houseIncircle(i: number): { cx: number; cy: number; r: number } {
  const poly = HOUSE_POLYGONS[i];
  const sides = poly.map((a, k) => Math.hypot(poly[(k + 1) % poly.length][0] - a[0], poly[(k + 1) % poly.length][1] - a[1]));
  const area = Math.abs(poly.reduce((sum, a, k) => sum + a[0] * poly[(k + 1) % poly.length][1] - poly[(k + 1) % poly.length][0] * a[1], 0)) / 2;
  const perimeter = sides.reduce((sum, side) => sum + side, 0);
  if (poly.length !== 3) return { cx: poly.reduce((s, p) => s + p[0], 0) / poly.length, cy: poly.reduce((s, p) => s + p[1], 0) / poly.length, r: (2 * area) / perimeter };
  // Incenter: the corners weighted by the length of the side opposite each.
  const weights = poly.map((_, k) => sides[(k + 1) % 3]);
  return {
    cx: poly.reduce((s, p, k) => s + p[0] * weights[k], 0) / perimeter,
    cy: poly.reduce((s, p, k) => s + p[1] * weights[k], 0) / perimeter,
    r: (2 * area) / perimeter,
  };
}

/** A hex colour mixed `amount` (0-1) of the way to white. */
function lighten(hex: string, amount: number): string {
  const channel = (k: number) => Math.round(parseInt(hex.slice(1 + k * 2, 3 + k * 2), 16) * (1 - amount) + 255 * amount);
  return `#${[0, 1, 2].map((k) => channel(k).toString(16).padStart(2, "0")).join("")}`;
}

/** Half-size (fraction of the side) kept clear around a house's icon / number circles. */
const BLOCKER_R = 0.05;

/**
 * How house i splits into two halves: `vertical` (a left/right split) or
 * not (top/bottom), the split line's position (fraction of the side), and
 * each half's label anchor on the line through the usual label point: the
 * middle of the widest stretch of its half not covered by one of
 * `blockers` (the house's icon and number circles) sitting on that line.
 */
function splitHouse(i: number, blockers: [number, number][] = []): { vertical: boolean; at: number; anchors: [[number, number], [number, number]] } {
  const [fx, fy] = HOUSES[i].label;
  const vertical = !SIDE_HOUSES.has(i);
  const along = vertical ? 0 : 1; // the axis the halves run along
  const line = vertical ? fy : fx;
  const [lo, hi] = spanAt(HOUSE_POLYGONS[i], vertical ? 1 : 0, line);
  const at = (lo + hi) / 2;
  const onLine = blockers.filter((b) => Math.abs(b[1 - along] - line) < BLOCKER_R * 0.9).map((b) => b[along]);
  const anchorIn = (from: number, to: number) => {
    // Free stretches of [from, to] between blockers; take the widest.
    let best: [number, number] = [from, to];
    let bestWidth = -1;
    let start = from;
    for (const c of [...onLine.filter((c) => c + BLOCKER_R > from && c - BLOCKER_R < to).sort((p, q) => p - q), Infinity]) {
      const end = Math.min(to, c - BLOCKER_R);
      if (end - start > bestWidth) {
        best = [start, end];
        bestWidth = end - start;
      }
      start = Math.max(start, c + BLOCKER_R);
    }
    return (best[0] + best[1]) / 2;
  };
  const a = anchorIn(lo, at);
  const b = anchorIn(at, hi);
  return { vertical, at, anchors: vertical ? [[a, fy], [b, fy]] : [[fx, a], [fx, b]] };
}

/** A label's drawn width, including retrograde parentheses -- matches devanagariLabelMarkup. */
function labelWidth(label: Label, fontSize: number, zoom = false): number {
  const glyph = DEVANAGARI_LABELS[label.text];
  if (!glyph) return 0;
  const parenWidth = label.retro ? measureVectorText("(", fontSize * 0.62, { strokeWidth: 0.1, tracking: 0 }) + fontSize * 0.04 : 0;
  return iconWidth(label, fontSize) + glyph.width * fontSize + parenWidth * 2 + stayWidth(label, fontSize, zoom);
}

function devanagariLabelMarkup(label: Label, cx: number, top: number, fontSize: number, zoom = false, iconId = "", moonIllumination = 0.5): string {
  const glyph = DEVANAGARI_LABELS[label.text];
  if (!glyph) return "";
  const parenSize = fontSize * 0.62;
  const parenStyle: TextStyle = { color: label.color, strokeWidth: 0.1, tracking: 0 };
  const parenWidth = label.retro ? measureVectorText("(", parenSize, parenStyle) + fontSize * 0.04 : 0;
  const textWidth = glyph.width * fontSize;
  const pieScale = pieScaleFor(zoom);
  const figureWidth = iconWidth(label, fontSize);
  const start = cx - labelWidth(label, fontSize, zoom) / 2;
  // Everything after the figure is laid out from `left`, as without one.
  const left = start + figureWidth;
  // The shirorekha (headline) sits ~0.7 em above the baseline in Noto Sans Devanagari.
  const baseline = top + fontSize * 0.72;
  const parenTop = top - fontSize * 0.02;
  const body = label.planet ? planetBodyFor(label.planet) : undefined;
  return [
    body && label.icon
      ? fittedPlanetBodyMarkup(body, iconId, start + (figureWidth - fontSize * ICON_GAP) / 2, top + fontSize * 0.42, label.icon * iconAspect(label.planet!), label.icon, moonIllumination)
      : "",
    label.retro ? buildCenteredVectorTextMarkup("(", left + parenWidth / 2, parenTop, parenSize, parenStyle) : "",
    `<path d="${glyph.d}" fill="${label.color}" transform="translate(${(left + parenWidth).toFixed(1)} ${baseline.toFixed(1)}) scale(${fontSize.toFixed(2)})" />`,
    label.retro ? buildCenteredVectorTextMarkup(")", left + parenWidth + textWidth + parenWidth / 2, parenTop, parenSize, parenStyle) : "",
    label.stay
      ? stayPieMarkup(
          left + textWidth + parenWidth * 2 + fontSize * (pieGapFor(zoom) + pieScale / 2),
          top + fontSize * 0.42,
          (fontSize * pieScale) / 2,
          label.stay.elapsed / label.stay.total,
          zoom
        )
      : "",
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
  /**
   * A background tint for house i (0-based, house 1 = 0), or null for none.
   * A pair splits the house in two halves (left/right, or top/bottom for
   * the narrow side triangles), each label going into the half whose
   * colour matches its own (see splitHouse).
   */
  houseFill?: (houseIndex: number) => string | [string, string] | null,
  /** The natal Moon sign: when given, each house also shows its count from it in a green circle. */
  moonSign?: number,
  /** Each graha's stay in its current sign so far, drawn as a small green/red pie after its label. */
  stayFor?: (planetName: string) => SignStay | undefined,
  /**
   * The full-screen view: labels and number circles set smaller relative
   * to the houses (the chart itself is much bigger, so they stay large),
   * leaving each house room to breathe, and pies big enough to show their
   * percentages -- and each graha's figure before its name, sized to the
   * room its house has left.
   */
  zoom = false,
  /** Zoomed: the Moon's lit share today, for its figure's phase. */
  moonIllumination = 0.5,
  /** Each graha's figure before its name (always, zoomed): the birth chart in the form draws them too. */
  figures = zoom
): string {
  const P = (fx: number, fy: number) => `${(x0 + fx * size).toFixed(1)} ${(y0 + fy * size).toFixed(1)}`;

  const stroke = Math.max(1.2, size * 0.006);
  const lines = [
    `M${P(0, 0)} L${P(1, 1)}`,
    `M${P(1, 0)} L${P(0, 1)}`,
    `M${P(0.5, 0)} L${P(1, 0.5)} L${P(0.5, 1)} L${P(0, 0.5)} Z`,
  ];

  const fills = HOUSE_POLYGONS.map((_, i) => houseFill?.(i) ?? null);
  const houseTints = fills
    .map((fill, i) => {
      if (!fill) return "";
      const corners = HOUSE_POLYGONS[i];
      const d = `M${corners.map(([fx, fy]) => P(fx, fy)).join(" L")} Z`;
      if (typeof fill === "string") return `<path d="${d}" fill="${fill}" fill-opacity="0.3" />`;
      // Two halves: each a rectangle over its side of the split line,
      // clipped to the house's outline.
      const { vertical, at } = splitHouse(i);
      const xs = corners.map(([fx]) => fx);
      const ys = corners.map(([, fy]) => fy);
      const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const halves: [number, number, number, number][] = vertical
        ? [[minX, minY, at - minX, maxY - minY], [at, minY, maxX - at, maxY - minY]]
        : [[minX, minY, maxX - minX, at - minY], [minX, at, maxX - minX, maxY - at]];
      const clipId = `house-split-${i}-${Math.round(x0)}-${Math.round(y0)}`;
      return `<clipPath id="${clipId}"><path d="${d}" /></clipPath><g clip-path="url(#${clipId})">${halves
        .map(([hx, hy, hw, hh], k) => `<rect x="${(x0 + hx * size).toFixed(1)}" y="${(y0 + hy * size).toFixed(1)}" width="${(hw * size).toFixed(1)}" height="${(hh * size).toFixed(1)}" fill="${fill[k]}" fill-opacity="0.3" />`)
        .join("")}</g>`;
    })
    .join("");

  const fontSize = size * (zoom ? 0.04 : 0.072);
  // The Luck Chart (with a natal Moon sign) sets its three numbers larger,
  // each in its own corner of the house (LUCK_LAYOUT) -- except zoomed,
  // where the whole chart is already large.
  const luck = moonSign !== undefined;
  const scale = luck ? (zoom ? ZOOM_NUMBER_SCALE : LUCK_NUMBER_SCALE) : 1;
  const iconAt = (i: number) => (luck ? LUCK_LAYOUT[i].icon : HOUSE_ICONS[i]);
  const signAt = (i: number) => (luck ? LUCK_LAYOUT[i].sign : HOUSES[i].num);
  const numberSize = size * 0.03 * scale;
  const numberStyle: TextStyle = { face: luck ? "clear" : undefined, color: "#f7c56a", strokeWidth: 0.15, tracking: 0.06 };
  const houseNumberStyle: TextStyle = { face: luck ? "clear" : undefined, color: "#e6e9f0", strokeWidth: 0.16, tracking: 0.06 };

  const byHouse: Label[][] = HOUSES.map(() => []);
  byHouse[0].push({ text: ASCENDANT_LABEL, retro: false, color: "#f7c56a" });
  for (const planet of kundli.planets) {
    const text = NEPALI_LABELS[planet.name];
    if (!text) continue;
    const house = (planet.sign - kundli.ascendantSign + 12) % 12;
    // Nodes always move backwards, so like the API's chart only true
    // planets get the (retrograde) parentheses.
    const retro = planet.retro && planet.name !== "Rahu" && planet.name !== "Ketu";
    byHouse[house].push({ text, retro, color: colorFor?.(planet.name) ?? "#fdf6e6", planet: planet.name, stay: stayFor?.(planet.name) });
  }
  for (const before of previous?.planets ?? []) {
    const text = NEPALI_LABELS[before.name];
    const now = kundli.planets.find((planet) => planet.name === before.name);
    if (!text || !now || now.sign === before.sign) continue;
    byHouse[(before.sign - kundli.ascendantSign + 12) % 12].push({ text, retro: false, color: MOVED_COLOR, struck: true, planet: before.name });
  }

  // Each label's center, so a moved graha can be joined to where it was.
  const centers = new Map<string, [number, number]>();
  // Numbers each graha figure's gradient ids, unique in the document.
  let iconCount = 0;
  // Zoomed pies stand a little taller than the text, so lines get more air.
  const lineStep = zoom ? 1.8 : 1.08;
  // The birth chart with figures fits each house's labels inside it (see
  // placeLabels); the Luck Chart keeps its own, already-tuned layout.
  const fitHouses = figures && !luck;
  const labels = byHouse
    .map((entries, i) => {
      const fill = fills[i];
      if (!Array.isArray(fill)) return placeLabels(entries, i, HOUSES[i].label, WIDE_HOUSES.has(i) ? 2 : 1, null);
      // A split house: labels in the colour of a half go there; anything
      // else (lagna, neutral, grey "was here") evens out the two sides.
      const groups: Label[][] = [[], []];
      const rest: Label[] = [];
      for (const entry of entries) {
        const k = fill.indexOf(entry.color);
        if (k === 0 || k === 1) groups[k].push(entry);
        else rest.push(entry);
      }
      for (const entry of rest) groups[groups[0].length <= groups[1].length ? 0 : 1].push(entry);
      const { anchors, vertical, at } = splitHouse(i, luck ? [LUCK_LAYOUT[i].icon, LUCK_LAYOUT[i].sign, LUCK_LAYOUT[i].moon] : [HOUSE_ICONS[i], HOUSES[i].num]);
      return groups.map((group, k) => placeLabels(group, i, anchors[k], 1, vertical ? { at, side: k } : null)).join("");
    })
    .join("");

  /**
   * Zoomed: each current graha in a row of labels centered on fx, at
   * height y, gets a figure as tall as the row's room in house i allows
   * (within ICON_MIN..ICON_MAX of the font size) -- the house's width
   * there, or just one half's in a left/right split house.
   */
  function withIcons(rowEntries: Label[], i: number, fx: number, y: number, half: { at: number; side: number } | null, fs = fontSize): Label[] {
    const planets = rowEntries.filter((entry) => entry.planet && !entry.struck && planetBodyFor(entry.planet));
    if (!figures || !planets.length) return rowEntries;
    let [lo, hi] = spanAt(HOUSE_POLYGONS[i], 1, (y - y0) / size);
    if (half) [lo, hi] = half.side === 0 ? [lo, Math.min(hi, half.at)] : [Math.max(lo, half.at), hi];
    // Fitted rows are re-centered in the house's span, so they get all of it.
    const room = !Number.isFinite(lo) || !Number.isFinite(hi) ? Infinity : fitHouses ? (hi - lo) * size * 0.85 : Math.max(0, 2 * Math.min(fx - lo, hi - fx) * size * 0.85);
    const rest = rowEntries.reduce((sum, entry) => sum + labelWidth(entry, fs, zoom), 0) + fs * 0.45 * (rowEntries.length - 1) + planets.length * fs * ICON_GAP;
    const perHeight = planets.reduce((sum, entry) => sum + iconAspect(entry.planet!), 0);
    // Never taller than a line, so stacked labels' figures don't touch.
    const icon = Math.min(fs * Math.min(ICON_MAX, lineStep * 0.92), Math.max(fs * ICON_MIN, (room - rest) / perHeight));
    return rowEntries.map((entry) => (planets.includes(entry) ? { ...entry, icon } : entry));
  }

  /** House i's own house icon and sign-number circle, as squares (center, half-side) in px, for labels to keep clear of. */
  function houseBlockers(i: number): { cx: number; cy: number; half: number }[] {
    const [ix, iy] = iconAt(i);
    const [sx, sy] = signAt(i);
    return [
      { cx: x0 + ix * size, cy: y0 + iy * size, half: (size * ICON_H * scale) / 2 },
      { cx: x0 + sx * size, cy: y0 + sy * size, half: size * 0.03 * scale },
    ];
  }

  /**
   * Rows of `entries` stacked on (fx, fy) in house i at font size fs:
   * each row's top, its labels (with figures) and their widths, and its
   * center x. Fitted (the birth chart), the stack is kept inside the
   * house's height at fx and each row is centered in the house's width at
   * its own height -- the triangles narrow fast toward their tips.
   */
  function rowLayout(entries: Label[], i: number, [fx, fy]: [number, number], perRow: number, half: { at: number; side: number } | null, fs: number) {
    const lineHeight = fs * lineStep;
    // Never above the house's own icon when that sits over the labels.
    const iconFy = iconAt(i)[1];
    const belowIcon = iconFy < fy ? y0 + (iconFy + (ICON_H * scale) / 2 + 0.008) * size : -Infinity;
    const rows: Label[][] = [];
    for (let k = 0; k < entries.length; k += perRow) rows.push(entries.slice(k, k + perRow));
    let top = Math.max(y0 + fy * size - (rows.length * lineHeight) / 2 + fs * 0.05, belowIcon);
    const [ylo, yhi] = spanAt(HOUSE_POLYGONS[i], 0, fx);
    if (fitHouses) top = Math.max(y0 + ylo * size + fs * 0.3, Math.min(top, y0 + yhi * size - rows.length * lineHeight - fs * 0.1));
    return rows.map((plainEntries, row) => {
      const y = top + row * lineHeight;
      const labels = withIcons(plainEntries, i, fx, y + fs * 0.42, half, fs);
      const widths = labels.map((entry) => labelWidth(entry, fs, zoom));
      const width = widths.reduce((sum, w) => sum + w, 0) + fs * 0.45 * (widths.length - 1);
      // The house's width over the row's whole height (narrower end wins).
      const spans = [y, y + fs * 0.95].map((at) => spanAt(HOUSE_POLYGONS[i], 1, (at - y0) / size));
      const lo = Math.max(...spans.map(([l]) => l));
      const hi = Math.min(...spans.map(([, h]) => h));
      let cx = x0 + fx * size;
      let room = Number.isFinite(lo) && Number.isFinite(hi) ? (hi - lo) * size - fs * 0.3 : Infinity;
      if (fitHouses && Number.isFinite(lo) && Number.isFinite(hi)) {
        // The widest stretch of the row left clear of the house's own icon
        // and sign-number circle, wherever they reach into it.
        let free: [number, number][] = [[x0 + lo * size + fs * 0.15, x0 + hi * size - fs * 0.15]];
        for (const b of houseBlockers(i)) {
          if (b.cy + b.half <= y - fs * 0.15 || b.cy - b.half >= y + fs * 1.05) continue;
          const [bl, br] = [b.cx - b.half - fs * 0.3, b.cx + b.half + fs * 0.3];
          free = free.flatMap(([l, r]): [number, number][] => (br <= l || bl >= r ? [[l, r]] : [...(bl > l ? [[l, bl] as [number, number]] : []), ...(br < r ? [[br, r] as [number, number]] : [])]));
        }
        const [left, right] = free.reduce((best, span) => (span[1] - span[0] > best[1] - best[0] ? span : best), [0, 0] as [number, number]);
        room = right - left;
        cx = width > room ? (left + right) / 2 : Math.min(Math.max(cx, left + width / 2), right - width / 2);
      }
      return { y, labels, widths, width, cx, room, top, bottom: y + lineHeight };
    });
  }

  /**
   * Stacks `entries` centered on (fx, fy) in house i, `perRow` to a row --
   * the wide, shallow triangles (houses 2, 6, 8, 12) set two side by side;
   * the others, and each half of a split house, one per line. Fitted (the
   * birth chart), a crowded house shrinks its labels and figures until
   * every row fits inside it.
   */
  function placeLabels(entries: Label[], i: number, anchor: [number, number], perRow: number, half: { at: number; side: number } | null): string {
    let fs = fontSize;
    let rows = rowLayout(entries, i, anchor, perRow, half, fs);
    if (fitHouses) {
      const [ylo, yhi] = spanAt(HOUSE_POLYGONS[i], 0, anchor[0]);
      const fits = () =>
        rows.every((row) => row.width <= row.room) && (!rows.length || rows[rows.length - 1].bottom <= y0 + yhi * size + fs * 0.05) && (!rows.length || rows[0].top >= y0 + ylo * size);
      for (let attempt = 0; attempt < 14 && !fits(); attempt++) {
        fs *= 0.92;
        rows = rowLayout(entries, i, anchor, perRow, half, fs);
      }
    }
    return rows
      .map(({ y, labels, widths, width, cx: rowCx }) => {
        let x = rowCx - width / 2;
        return labels
          .map((entry, k) => {
            const cx = x + widths[k] / 2;
            x += widths[k] + fs * 0.45;
            // The name's own center (not its figure's or pie's), for the move arrow and ring.
            const nameCx = cx + (iconWidth(entry, fs) - stayWidth(entry, fs, zoom)) / 2;
            if (entry.planet) centers.set(`${entry.planet}:${entry.struck ? "was" : "now"}`, [nameCx, y + fs * 0.45]);
            return devanagariLabelMarkup(entry, cx, y, fs, zoom, `luck-body-${Math.round(x0)}-${iconCount++}`, moonIllumination);
          })
          .join("");
      })
      .join("");
  }

  // A dashed line from where each moved graha last was to where it
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
  const circleR = size * 0.03 * scale;
  const lineW = Math.max(1, size * 0.004);
  const numbers = HOUSES.map((_, i) => {
    const [fx, fy] = signAt(i);
    const sign = ((kundli.ascendantSign - 1 + i) % 12) + 1;
    const cx = x0 + fx * size;
    const cy = y0 + fy * size;
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${circleR.toFixed(1)}" fill="#080b16" stroke="#f7c56a" stroke-width="${lineW.toFixed(1)}" />${buildCenteredVectorTextMarkup(String(sign), cx, cy - numberSize / 2, numberSize, numberStyle)}`;
  }).join("");

  // House number of each house, in a small house-shaped icon in its own
  // section (house 1 is always the top diamond, counter-clockwise from there).
  const iconW = size * 0.068 * scale;
  const iconH = size * ICON_H * scale;
  const roofH = iconH * 0.42;
  const houseNumberSize = size * 0.029 * scale;
  const houseIcons = HOUSE_ICONS.map((_, i) => {
    const [fx, fy] = iconAt(i);
    const cx = x0 + fx * size;
    const top = y0 + fy * size - iconH / 2;
    const left = (cx - iconW / 2).toFixed(1);
    const right = (cx + iconW / 2).toFixed(1);
    const eave = top + roofH;
    const bottom = top + iconH;
    const shape = `M${cx.toFixed(1)} ${top.toFixed(1)} L${right} ${eave.toFixed(1)} L${right} ${bottom.toFixed(1)} L${left} ${bottom.toFixed(1)} L${left} ${eave.toFixed(1)} Z`;
    return `<path d="${shape}" fill="#080b16" stroke="#c9cfdc" stroke-width="${lineW.toFixed(1)}" stroke-linejoin="round" />${buildCenteredVectorTextMarkup(String(i + 1), cx, (eave + bottom) / 2 - houseNumberSize / 2, houseNumberSize, houseNumberStyle)}`;
  }).join("");

  // The natal Moon sign (the rashi) as a faint watermark filling the house
  // the Moon count starts from, as large as that house allows: the sign's
  // own drawing without its badge, lightened to read on the dark chart.
  let watermark = "";
  if (moonSign !== undefined) {
    const i = (moonSign - kundli.ascendantSign + 12) % 12;
    const sign = ZODIAC_SIGNS[moonSign - 1];
    const { cx, cy, r } = houseIncircle(i);
    // The drawings fill ~85% of their 100-unit box, so the box slightly
    // overshoots the circle to fill it.
    const side = r * 2 * 1.1 * size;
    // Clipped to the house, so no stray detail crosses into the next one.
    const clipId = `rashi-mark-${Math.round(x0)}-${Math.round(y0)}`;
    const outline = `M${HOUSE_POLYGONS[i].map(([fx, fy]) => P(fx, fy)).join(" L")} Z`;
    watermark = `<clipPath id="${clipId}"><path d="${outline}" /></clipPath><g clip-path="url(#${clipId})"><g opacity="0.3" transform="translate(${(x0 + cx * size - side / 2).toFixed(1)} ${(y0 + cy * size - side / 2).toFixed(1)}) scale(${(side / 100).toFixed(4)})">${zodiacIconMarkup(sign, "#080b16", lighten(ZODIAC_COLORS[sign], 0.6))}</g></g>`;
  }

  // House counted from the natal Moon sign (what gochar results are read
  // from), in a green circle a little larger than the rashi number's.
  const moonCountR = size * 0.036 * scale;
  const moonCountSize = size * 0.036 * scale;
  const moonCountStyle: TextStyle = { face: "clear", color: "#ffffff", strokeWidth: 0.17, tracking: 0.04 };
  const moonCounts =
    moonSign === undefined
      ? ""
      : LUCK_LAYOUT.map(({ moon: [fx, fy] }, i) => {
          const sign = ((kundli.ascendantSign - 1 + i) % 12) + 1;
          const count = ((sign - moonSign + 12) % 12) + 1;
          const cx = x0 + fx * size;
          const cy = y0 + fy * size;
          return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${moonCountR.toFixed(1)}" fill="${MOON_COUNT_COLOR}" stroke="#080b16" stroke-width="${lineW.toFixed(1)}" />${buildCenteredVectorTextMarkup(String(count), cx, cy - moonCountSize / 2, moonCountSize, moonCountStyle)}`;
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
    ${watermark}
    <path d="${lines.join(" ")}" fill="none" stroke="#f7c56a" stroke-opacity="0.85" stroke-width="${stroke.toFixed(1)}" />
    ${houseIcons}
    ${numbers}
    ${moonCounts}
    ${labels}
    ${moves}
  </g>`;
}
