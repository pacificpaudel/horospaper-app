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
// Solar System's planets (real heliocentric longitudes) move day to day.
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
// SVG angles: 0° = right, 90° = down (y grows downward). The Sun is drawn
// straight below the Center, as in the standard NASA/JPL top-down map.
const SUN_ANGLE_DEG = 90;
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

function spiralArmMarkup(cx: number, cy: number, scale: number, armIndex: number, rand: () => number, dotScale: number): string {
  const k = Math.tan(rad(PITCH_DEG));
  const baseKpc = NORMA_AT_SUN_KPC * Math.exp((k * armIndex * Math.PI) / 2);
  const phiStart = Math.log(3.2 / baseKpc) / k;
  const phiEnd = Math.log(DISC_KPC / baseKpc) / k;
  const steps = 70;

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
  const glow = `<path d="${d}" fill="none" stroke="#a9c1ff" stroke-opacity="0.16" stroke-width="${(1.5 * scale).toFixed(1)}" stroke-linecap="round" />`;

  const stars = points
    .flatMap(([x, y, rKpc]) =>
      Array.from({ length: 2 }, () => {
        const jitter = (rand() - 0.5) * 1.1 * scale;
        const jitterAngle = rand() * 360;
        const [sx, sy] = polar(x, y, jitter, jitterAngle);
        const fade = 1 - (rKpc / DISC_KPC) * 0.55;
        const color = rand() < 0.12 ? "#ffb3c7" : rand() < 0.5 ? "#dfe8ff" : "#ffffff";
        return `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${((0.5 + rand() * 0.9) * dotScale).toFixed(2)}" fill="${color}" opacity="${(0.35 + rand() * 0.5 * fade).toFixed(2)}" />`;
      }),
    )
    .join("");

  return glow + stars;
}

/** Tiny Sun + inner planets at their real heliocentric longitudes (not to scale). */
function miniSolarSystemMarkup(x: number, y: number, size: number, date: Date): string {
  const planets: { body: Astronomy.Body; ring: number; color: string }[] = [
    { body: Astronomy.Body.Mercury, ring: 0.03, color: "#c9c3b8" },
    { body: Astronomy.Body.Venus, ring: 0.043, color: "#f0cc85" },
    { body: Astronomy.Body.Earth, ring: 0.057, color: "#5fb0ff" },
    { body: Astronomy.Body.Mars, ring: 0.072, color: "#e0714a" },
  ];
  const strokeW = Math.max(0.5, size * 0.0025);
  const markup = planets.map(({ body, ring, color }) => {
    const r = ring * size;
    // Heliocentric ecliptic longitude, counter-clockwise from above like
    // the Galaxy's own frame. (The ecliptic is tilted ~60° to the galactic
    // plane; at this scale it's drawn face-on.)
    const longitude = Astronomy.EclipticLongitude(body, date);
    const [px, py] = polar(x, y, r, -longitude);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="${strokeW.toFixed(2)}" />
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${Math.max(1.2, size * 0.0075).toFixed(1)}" fill="${color}" />`;
  });
  return `
    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(size * 0.1).toFixed(1)}" fill="#0b1220" fill-opacity="0.55" stroke="#f7c56a" stroke-opacity="0.7" stroke-width="${(strokeW * 1.6).toFixed(2)}" />
    ${markup.join("")}
    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${Math.max(1.8, size * 0.013).toFixed(1)}" fill="#ffd66b" />`;
}

/**
 * Returns the galaxy panel as SVG markup, centered on a `width`x`height`
 * canvas. Semi-transparent so the day's artwork still reads through it; the
 * center is clear of the corner planet diagrams, the top date header and
 * the bottom luck meter on every canvas shape.
 */
export function buildGalaxyMarkup(width: number, height: number, generationDate: string): string {
  const minDim = Math.min(width, height);
  const size = Math.round(Math.max(150, Math.min(320, minDim * 0.3)));
  const titleSize = size * 0.045;
  const panelHeight = size + titleSize * 1.4;
  const originX = Math.round((width - size) / 2);
  const originY = Math.round((height - panelHeight) / 2);

  const cx = size / 2;
  const cy = size / 2 + titleSize * 0.9;
  const discR = size * 0.41;
  const scale = discR / DISC_KPC;
  const dotScale = size / 260;
  const rand = mulberry32(8_200);

  const arms = [0, 1, 2, 3].map((i) => spiralArmMarkup(cx, cy, scale, i, rand, dotScale)).join("");

  const [sunX, sunY] = polar(cx, cy, SUN_KPC * scale, SUN_ANGLE_DEG);
  const orionSpur = (() => {
    const pts = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8;
      return polar(cx, cy, (7.9 + t * 0.9) * scale, SUN_ANGLE_DEG - 22 + t * 34);
    });
    return `<path d="${pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")}" fill="none" stroke="#c7d6ff" stroke-opacity="0.22" stroke-width="${(0.9 * scale).toFixed(1)}" stroke-linecap="round" />`;
  })();

  const axisStroke = Math.max(0.8, size * 0.004);
  const axes = [BAR_NEAR_END_DEG, BAR_NEAR_END_DEG + 90]
    .map((angle) => {
      const [x1, y1] = polar(cx, cy, discR * 1.04, angle);
      const [x2, y2] = polar(cx, cy, discR * 1.04, angle + 180);
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#ffffff" stroke-opacity="0.32" stroke-width="${axisStroke.toFixed(2)}" stroke-dasharray="${(size * 0.015).toFixed(1)} ${(size * 0.015).toFixed(1)}" />`;
    })
    .join("");

  // Quadrant q spans [nearEnd + 90q, nearEnd + 90(q+1)] in the direction of
  // rotation (clockwise = increasing SVG angle).
  const sunQuadrant = Math.floor(((((SUN_ANGLE_DEG - BAR_NEAR_END_DEG) % 360) + 360) % 360) / 90);
  const wedgeFrom = BAR_NEAR_END_DEG + sunQuadrant * 90;
  const [wx1, wy1] = polar(cx, cy, discR, wedgeFrom);
  const [wx2, wy2] = polar(cx, cy, discR, wedgeFrom + 90);
  const highlight = `<path d="M${cx.toFixed(1)} ${cy.toFixed(1)} L${wx1.toFixed(1)} ${wy1.toFixed(1)} A${discR.toFixed(1)} ${discR.toFixed(1)} 0 0 1 ${wx2.toFixed(1)} ${wy2.toFixed(1)} Z" fill="#f7c56a" fill-opacity="0.09" />`;

  const labelSize = size * 0.042;
  const labels = QUADRANT_LABELS.map((label, q) => {
    const [lx, ly] = polar(cx, cy, discR * 0.9, BAR_NEAR_END_DEG + q * 90 + 45);
    const color = q === sunQuadrant ? "#f7c56a" : "#dfe8ff";
    return buildCenteredVectorTextMarkup(label, lx, ly - labelSize / 2, labelSize, { color, opacity: 0.85, strokeWidth: 0.14, tracking: 0.2 });
  }).join("");

  const title = buildCenteredVectorTextMarkup("MILKY WAY", cx, size * 0.035, titleSize, { color: "#dfe8ff", opacity: 0.8, strokeWidth: 0.12, tracking: 0.3 });

  return `
  <g transform="translate(${originX} ${originY})">
    <defs>
      <radialGradient id="mwDisc" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fff1cf" stop-opacity="0.32" />
        <stop offset="35%" stop-color="#b9c8ff" stop-opacity="0.12" />
        <stop offset="100%" stop-color="#6d7fd6" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="mwCore" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fff6de" stop-opacity="0.95" />
        <stop offset="45%" stop-color="#ffd98f" stop-opacity="0.55" />
        <stop offset="100%" stop-color="#ffb35c" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="${size}" height="${panelHeight.toFixed(1)}" rx="${(size * 0.11).toFixed(1)}" fill="#0b1220" fill-opacity="0.38" stroke="#ffffff" stroke-opacity="0.16" stroke-width="1.4" />
    ${title}
    <g opacity="0.88">
      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${discR.toFixed(1)}" fill="url(#mwDisc)" />
      ${highlight}
      ${arms}
      ${orionSpur}
      <ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(BAR_HALF_KPC * scale).toFixed(1)}" ry="${(1.3 * scale).toFixed(1)}" fill="url(#mwCore)" transform="rotate(${BAR_NEAR_END_DEG} ${cx.toFixed(1)} ${cy.toFixed(1)})" />
      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(2.2 * scale).toFixed(1)}" fill="url(#mwCore)" />
      ${axes}
      ${labels}
    </g>
    ${miniSolarSystemMarkup(sunX, sunY, size, new Date(`${generationDate}T12:00:00Z`))}
  </g>`;
}
