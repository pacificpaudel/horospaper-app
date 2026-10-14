import * as Astronomy from "astronomy-engine";
import { buildCenteredVectorTextMarkup } from "./vectorFont";

// A top-down (from the North Galactic Pole) sketch of the Milky Way with the
// Solar System marked where it actually sits, drawn from published
// structure rather than as decoration:
//   - Sun 8.2 kpc from the Galactic Center (GRAVITY Collaboration 2019);
//     stellar disc drawn out to ~15 kpc.
//   - Central bar ~4.5 kpc half-length, its near end ~27° from the
//     Sun-Center line toward galactic longitude +l (Wegg et al. 2015).
//   - 4 logarithmic-spiral arms, pitch 12.5° -- with that pitch, the arms
//     cross the Sun-Center line at 3.6 (Norma), 5.1 (Scutum-Centaurus),
//     7.2 (Sagittarius-Carina), 10.2 (Perseus) and 14.4 kpc (Norma's outer
//     continuation), matching the measured radii. The Sun sits in the
//     small Orion Spur between Sagittarius and Perseus.
// Seen from the North Galactic Pole the Galaxy turns clockwise and its arms
// trail, winding counter-clockwise as they move outward. The Sun's
// ~230-million-year orbit means its place here doesn't visibly change
// within a human lifetime -- so the galaxy is fixed; only the miniature
// Solar System's planets move day to day.
//
// The map is a top view (from the North Galactic Pole), turned so that up
// is North: the direction of the celestial north pole (Polaris) projected
// onto the galactic disc -- galactic longitude ~122.9°, computed below --
// with East right, South down and West left, as on a map. A compass at the
// Galactic Center shows it. The Solar System inset uses the same top view:
// each planet sits in the direction it truly lies from the Sun on the day.
//
// The disc is split into 4 quadrants on the bar's axes (the Galaxy's own
// fixed frame), numbered I-IV from the bar's near end in the direction of
// rotation; the Sun falls in quadrant IV, which is highlighted.

const DISC_KPC = 15;
const SUN_KPC = 8.2;
const BAR_HALF_KPC = 4.5;
const BAR_ANGLE_DEG = 27;
const PITCH_DEG = 12.5;
const NORMA_AT_SUN_KPC = 3.58;
// SVG angles: 0° = right, 90° = down (y grows downward). Galactic
// longitude grows counter-clockwise seen from the North Galactic Pole, so a
// direction at longitude l is drawn at screenAngle(l), with North straight up.
const GALACTIC = Astronomy.Rotation_EQJ_GAL();
const toGalactic = (vector: Astronomy.Vector) => Astronomy.RotateVector(GALACTIC, vector);
const longitudeOf = (vector: Astronomy.Vector) => (Math.atan2(vector.y, vector.x) * 180) / Math.PI;
/** Celestial north (the J2000 pole) projected onto the galactic disc: its galactic longitude. */
const NORTH_L = longitudeOf(toGalactic(new Astronomy.Vector(0, 0, 1, Astronomy.MakeTime(new Date(Date.UTC(2000, 0, 1, 12))))));
const screenAngle = (longitudeDeg: number) => -90 - (longitudeDeg - NORTH_L);
// The Sun sits opposite the Galactic Center's direction (longitude 0) from it.
const SUN_ANGLE_DEG = screenAngle(0) + 180;
const BAR_NEAR_END_DEG = SUN_ANGLE_DEG + BAR_ANGLE_DEG;
const QUADRANT_LABELS = ["I", "II", "III", "IV"];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rad = (deg: number) => (deg * Math.PI) / 180;

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  return [cx + r * Math.cos(rad(angleDeg)), cy + r * Math.sin(rad(angleDeg))];
}

function spiralArmMarkup(cx: number, cy: number, scale: number, armIndex: number, rand: () => number, dotScale: number, steps: number): string {
  const k = Math.tan(rad(PITCH_DEG));
  const baseKpc = NORMA_AT_SUN_KPC * Math.exp((k * armIndex * Math.PI) / 2);
  const phiStart = Math.log(3.2 / baseKpc) / k;
  const phiEnd = Math.log(DISC_KPC / baseKpc) / k;

  const points: [number, number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const phi = phiStart + ((phiEnd - phiStart) * i) / steps;
    const rKpc = baseKpc * Math.exp(k * phi);
    // Winding counter-clockwise (decreasing SVG angle) as radius grows.
    const angle = SUN_ANGLE_DEG - (phi * 180) / Math.PI;
    const [x, y] = polar(cx, cy, rKpc * scale, angle);
    points.push([x, y, rKpc]);
  }

  const d = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const glow = `<path d="${d}" fill="none" stroke="#e4ecff" stroke-opacity="0.18" stroke-width="${(0.8 * scale).toFixed(1)}" stroke-linecap="round" />`;

  const stars = points
    .flatMap(([x, y, rKpc]) =>
      Array.from({ length: 2 }, () => {
        const jitter = (rand() - 0.5) * 1.1 * scale;
        const jitterAngle = rand() * 360;
        const [sx, sy] = polar(x, y, jitter, jitterAngle);
        const fade = 1 - (rKpc / DISC_KPC) * 0.55;
        const color = rand() < 0.12 ? "#ffb3c7" : rand() < 0.5 ? "#dfe8ff" : "#ffffff";
        return `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${((0.5 + rand() * 0.9) * dotScale).toFixed(2)}" fill="${color}" opacity="${(0.5 + rand() * 0.45 * fade).toFixed(2)}" />`;
      }),
    )
    .join("");

  return glow + stars;
}

// The 8 planets, Sun outward, on evenly spaced rings (not to scale, so the
// outer ones stay visible), each with its own colour and a little size.
const PLANETS: { body: Astronomy.Body; color: string; size: number; ring?: boolean }[] = [
  { body: Astronomy.Body.Mercury, color: "#c9c3b8", size: 0.8 },
  { body: Astronomy.Body.Venus, color: "#f0cc85", size: 1 },
  { body: Astronomy.Body.Earth, color: "#5fb0ff", size: 1.05 },
  { body: Astronomy.Body.Mars, color: "#e0714a", size: 0.9 },
  { body: Astronomy.Body.Jupiter, color: "#e3b98a", size: 1.6 },
  { body: Astronomy.Body.Saturn, color: "#e9d39a", size: 1.35, ring: true },
  { body: Astronomy.Body.Uranus, color: "#9be3ea", size: 1.15 },
  { body: Astronomy.Body.Neptune, color: "#5b7cf0", size: 1.15 },
];

/**
 * The Solar System seen from above, like the galaxy around it (radius
 * `r`, centered on (x, y)): the Sun and all 8 planets, each in the
 * direction it truly lies from the Sun at `date` -- its heliocentric
 * position turned into galactic coordinates and viewed from the North
 * Galactic Pole, North up (see screenAngle).
 */
function solarSystemMarkup(x: number, y: number, r: number, date: Date): string {
  const time = Astronomy.MakeTime(date);
  const strokeW = Math.max(0.6, r * 0.012);
  const dot = r * 0.05;
  const rings = PLANETS.map(({ body, color, size, ring }, i) => {
    const orbitR = r * (0.22 + (i * 0.7) / (PLANETS.length - 1));
    const [px, py] = polar(x, y, orbitR, screenAngle(longitudeOf(toGalactic(Astronomy.HelioVector(body, time)))));
    const pr = Math.max(1.4, dot * size);
    const saturnRing = ring
      ? `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(pr * 1.9).toFixed(1)}" ry="${(pr * 0.6).toFixed(1)}" fill="none" stroke="${color}" stroke-opacity="0.85" stroke-width="${(pr * 0.3).toFixed(1)}" transform="rotate(-20 ${px.toFixed(1)} ${py.toFixed(1)})" />`
      : "";
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${orbitR.toFixed(1)}" fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="${strokeW.toFixed(2)}" />
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${pr.toFixed(1)}" fill="${color}" stroke="#05070f" stroke-width="${(strokeW * 0.8).toFixed(2)}" />${saturnRing}`;
  });
  return `
    <defs>
      <radialGradient id="solarSun" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fff6d6" />
        <stop offset="55%" stop-color="#ffcf4d" />
        <stop offset="100%" stop-color="#ff9d2e" stop-opacity="0" />
      </radialGradient>
    </defs>
    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#0b1220" fill-opacity="0.6" stroke="#f7c56a" stroke-opacity="0.75" stroke-width="${(strokeW * 1.5).toFixed(2)}" />
    ${rings.join("")}
    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 0.13).toFixed(1)}" fill="url(#solarSun)" />`;
}

/** A compass rose at (x, y), radius `r`: N (gold, up), E, S, W -- the map's directions. */
function compassMarkup(x: number, y: number, r: number): string {
  const stroke = Math.max(1, r * 0.025);
  const labelSize = r * 0.24;
  const points = [
    { label: "N", angle: -90, color: "#f7c56a" },
    { label: "E", angle: 0, color: "#dfe8ff" },
    { label: "S", angle: 90, color: "#dfe8ff" },
    { label: "W", angle: 180, color: "#dfe8ff" },
  ];
  const ticks = Array.from({ length: 8 }, (_, i) => {
    const angle = i * 45;
    const [x1, y1] = polar(x, y, r * (i % 2 ? 0.86 : 0.8), angle);
    const [x2, y2] = polar(x, y, r, angle);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#dfe8ff" stroke-opacity="0.7" stroke-width="${stroke.toFixed(1)}" />`;
  }).join("");
  const labels = points
    .map(({ label, angle, color }) => {
      const [lx, ly] = polar(x, y, r + labelSize * 0.9, angle);
      return buildCenteredVectorTextMarkup(label, lx, ly - labelSize / 2, labelSize, { color, strokeWidth: 0.16, tracking: 0 });
    })
    .join("");
  // The north needle: a gold arrowhead on the ring, pointing up.
  const [nx, ny] = polar(x, y, r * 1.02, -90);
  const needle = `<path d="M${nx.toFixed(1)} ${(ny - r * 0.06).toFixed(1)} L${(nx - r * 0.12).toFixed(1)} ${(ny + r * 0.18).toFixed(1)} L${(nx + r * 0.12).toFixed(1)} ${(ny + r * 0.18).toFixed(1)} Z" fill="#f7c56a" />`;
  return `<g opacity="0.9"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="#dfe8ff" stroke-opacity="0.55" stroke-width="${stroke.toFixed(1)}" />${ticks}${needle}${labels}</g>`;
}

/**
 * Returns the galaxy as SVG markup spanning the full width of a
 * `width`x`height` canvas, centered on it, with no backdrop -- the day's
 * artwork shows through the semi-transparent disc. On a landscape canvas
 * the disc is taller than the canvas, so its top and bottom edges run off
 * the image. Callers draw it first, under the other overlays.
 */
export function buildGalaxyMarkup(width: number, height: number, generationDate: string): string {
  const cx = width / 2;
  // On a wide canvas the Galactic Center sits a little below the middle, so
  // the Solar System (up and left of it, North being up) lands in open space
  // below the top row (date panel and calmness gauge), not on it.
  const cy = height / 2 + (width > height ? height * 0.18 : 0);
  const discR = width / 2;
  const scale = discR / DISC_KPC;
  // Labels and the Solar System inset stay a readable, fixed-ish size
  // however large the disc gets.
  const ui = Math.min(width, height) * 0.3;
  const dotScale = Math.min(2.4, width / 520);
  const steps = Math.round(Math.max(70, Math.min(260, width / 6)));
  const rand = mulberry32(8_200);

  const arms = [0, 1, 2, 3].map((i) => spiralArmMarkup(cx, cy, scale, i, rand, dotScale, steps)).join("");

  const [sunX, sunY] = polar(cx, cy, SUN_KPC * scale, SUN_ANGLE_DEG);
  const orionSpur = (() => {
    const pts = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8;
      return polar(cx, cy, (7.9 + t * 0.9) * scale, SUN_ANGLE_DEG - 22 + t * 34);
    });
    return `<path d="${pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")}" fill="none" stroke="#c7d6ff" stroke-opacity="0.22" stroke-width="${(0.9 * scale).toFixed(1)}" stroke-linecap="round" />`;
  })();

  const axisStroke = Math.max(1, ui * 0.005);
  const dash = (ui * 0.03).toFixed(1);
  const axes = [BAR_NEAR_END_DEG, BAR_NEAR_END_DEG + 90]
    .map((angle) => {
      const [x1, y1] = polar(cx, cy, discR, angle);
      const [x2, y2] = polar(cx, cy, discR, angle + 180);
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#ffffff" stroke-opacity="0.3" stroke-width="${axisStroke.toFixed(2)}" stroke-dasharray="${dash} ${dash}" />`;
    })
    .join("");

  // Quadrant q spans [nearEnd + 90q, nearEnd + 90(q+1)] in the direction of
  // rotation (clockwise = increasing SVG angle).
  const sunQuadrant = Math.floor(((((SUN_ANGLE_DEG - BAR_NEAR_END_DEG) % 360) + 360) % 360) / 90);
  const wedgeFrom = BAR_NEAR_END_DEG + sunQuadrant * 90;
  const [wx1, wy1] = polar(cx, cy, discR, wedgeFrom);
  const [wx2, wy2] = polar(cx, cy, discR, wedgeFrom + 90);
  const highlight = `<path d="M${cx.toFixed(1)} ${cy.toFixed(1)} L${wx1.toFixed(1)} ${wy1.toFixed(1)} A${discR.toFixed(1)} ${discR.toFixed(1)} 0 0 1 ${wx2.toFixed(1)} ${wy2.toFixed(1)} Z" fill="#f7c56a" fill-opacity="0.07" />`;

  // Quadrant numerals sit 60% of the way out, where they stay on-canvas
  // even when the disc overflows a landscape image vertically.
  const labelSize = ui * 0.06;
  const labels = QUADRANT_LABELS.map((label, q) => {
    const [lx, ly] = polar(cx, cy, discR * 0.6, BAR_NEAR_END_DEG + q * 90 + 45);
    const color = q === sunQuadrant ? "#f7c56a" : "#dfe8ff";
    return buildCenteredVectorTextMarkup(label, lx, ly - labelSize / 2, labelSize, { color, opacity: 0.8, strokeWidth: 0.12, tracking: 0.2 });
  }).join("");

  return `
  <g>
    <defs>
      <radialGradient id="mwDisc" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fff1cf" stop-opacity="0.3" />
        <stop offset="35%" stop-color="#b9c8ff" stop-opacity="0.1" />
        <stop offset="100%" stop-color="#6d7fd6" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="mwCore" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fff6de" stop-opacity="0.9" />
        <stop offset="45%" stop-color="#ffd98f" stop-opacity="0.5" />
        <stop offset="100%" stop-color="#ffb35c" stop-opacity="0" />
      </radialGradient>
    </defs>
    <g opacity="0.85">
      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${discR.toFixed(1)}" fill="url(#mwDisc)" />
      ${highlight}
      ${arms}
      ${orionSpur}
      <ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(BAR_HALF_KPC * scale).toFixed(1)}" ry="${(1.3 * scale).toFixed(1)}" fill="url(#mwCore)" transform="rotate(${BAR_NEAR_END_DEG} ${cx.toFixed(1)} ${cy.toFixed(1)})" />
      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(2.2 * scale).toFixed(1)}" fill="url(#mwCore)" />
      ${axes}
      ${labels}
    </g>
    ${compassMarkup(cx, cy, Math.min(width, height) * (width > height ? 0.075 : 0.1))}
    ${solarSystemMarkup(sunX, sunY, Math.min(width, height) * 0.085, new Date(`${generationDate}T12:00:00Z`))}
  </g>`;
}
