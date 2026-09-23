import { StructuredAstrologyData } from "@/lib/astrology";
import { DiagramPlanet, planetBodyMarkup } from "./planetBodies";

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface DiagramSpec {
  planet: DiagramPlanet;
  corner: Corner;
}

const DIAGRAMS: DiagramSpec[] = [
  { planet: "sun", corner: "top-left" },
  { planet: "moon", corner: "top-right" },
  { planet: "saturn", corner: "bottom-left" },
  { planet: "mars", corner: "bottom-right" },
];

function longitudeFor(planet: DiagramPlanet, astrology: StructuredAstrologyData): number {
  const { today } = astrology;
  switch (planet) {
    case "sun":
      return today.sunLongitude;
    case "moon":
      return today.moonLongitude;
    case "saturn":
      return today.saturnLongitude;
    case "mars":
      return today.marsLongitude;
  }
}

/** A small geographical-globe rendering of Earth (ocean + continent shapes), sized to fit an r-radius circle. */
function earthMarkup(id: string, r: number): string {
  return `
    <defs>
      <radialGradient id="${id}" cx="34%" cy="30%" r="75%">
        <stop offset="0%" stop-color="#8fd4ff" />
        <stop offset="55%" stop-color="#2e79c9" />
        <stop offset="100%" stop-color="#123a66" />
      </radialGradient>
      <clipPath id="${id}-clip"><circle r="${r}" /></clipPath>
    </defs>
    <g clip-path="url(#${id}-clip)">
      <circle r="${r}" fill="url(#${id})" />
      <path d="M${(-r * 0.62).toFixed(1)} ${(-r * 0.55).toFixed(1)} q${(r * 0.45).toFixed(1)} ${(-r * 0.3).toFixed(1)} ${(r * 0.6).toFixed(1)} ${(-r * 0.02).toFixed(1)} q${(r * 0.22).toFixed(1)} ${(r * 0.32).toFixed(1)} ${(-r * 0.12).toFixed(1)} ${(r * 0.5).toFixed(1)} q${(-r * 0.5).toFixed(1)} ${(r * 0.14).toFixed(1)} ${(-r * 0.48).toFixed(1)} ${(-r * 0.48).toFixed(1)}Z" fill="#3f8f4f" opacity="0.92" />
      <path d="M${(r * 0.02).toFixed(1)} ${(r * 0.08).toFixed(1)} q${(r * 0.34).toFixed(1)} ${(-r * 0.12).toFixed(1)} ${(r * 0.46).toFixed(1)} ${(r * 0.2).toFixed(1)} q${(r * 0.08).toFixed(1)} ${(r * 0.38).toFixed(1)} ${(-r * 0.28).toFixed(1)} ${(r * 0.45).toFixed(1)} q${(-r * 0.38).toFixed(1)} ${(-r * 0.03).toFixed(1)} ${(-r * 0.18).toFixed(1)} ${(-r * 0.65).toFixed(1)}Z" fill="#3f8f4f" opacity="0.85" />
      <ellipse cx="${(-r * 0.15).toFixed(1)}" cy="${(-r * 0.62).toFixed(1)}" rx="${(r * 0.5).toFixed(1)}" ry="${(r * 0.18).toFixed(1)}" fill="#f5f8ff" opacity="0.35" />
    </g>
    <circle r="${r}" fill="none" stroke="#dff0ff" stroke-opacity="0.55" stroke-width="${Math.max(0.6, r * 0.09).toFixed(1)}" />`;
}

function diagramGroup(spec: DiagramSpec, x: number, y: number, size: number, astrology: StructuredAstrologyData, uid: string): string {
  const longitude = longitudeFor(spec.planet, astrology);
  const angleRad = (longitude * Math.PI) / 180;
  const cx = size / 2;
  const cy = size / 2;
  const orbitR = size * 0.33;
  const px = cx + orbitR * Math.cos(angleRad);
  const py = cy - orbitR * Math.sin(angleRad);
  const planetR = spec.planet === "sun" ? size * 0.1 : spec.planet === "saturn" ? size * 0.085 : size * 0.09;
  const earthR = size * 0.065;
  const axisFrom = size * 0.08;
  const axisTo = size * 0.92;
  const gradId = `${uid}-${spec.planet}`;
  const earthId = `${uid}-earth`;

  return `
  <g transform="translate(${x} ${y})">
    <rect width="${size}" height="${size}" rx="${(size * 0.11).toFixed(1)}" fill="#0b1220" fill-opacity="0.52" stroke="#ffffff" stroke-opacity="0.16" stroke-width="1.4" />
    <line x1="${cx.toFixed(1)}" y1="${axisFrom.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${axisTo.toFixed(1)}" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1" stroke-dasharray="3 3" />
    <line x1="${axisFrom.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${axisTo.toFixed(1)}" y2="${cy.toFixed(1)}" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1" stroke-dasharray="3 3" />
    <g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})">
      <circle r="${(earthR * 1.7).toFixed(1)}" fill="#4fa3ff" opacity="0.16" />
      ${earthMarkup(earthId, earthR)}
    </g>
    <g transform="translate(${px.toFixed(1)} ${py.toFixed(1)})">
      ${planetBodyMarkup(spec.planet, gradId, planetR, astrology.today.moonIllumination)}
    </g>
  </g>`;
}

/**
 * Returns the 4 corner planet-position diagrams as SVG markup for a
 * `width`x`height` canvas. On the desktop (landscape) canvas the diagrams
 * sit flush against all 4 edges -- like they're mounted directly on the
 * frame's walls -- since the desktop output page and frame mode both show
 * this canvas with object-fit: contain (never cropped), so there's no more
 * need for a safety inset there. This doesn't collide with the date header
 * or luck meter: both are horizontally centered (dateHeaderOverlay.ts,
 * luckMeterOverlay.ts) while the diagrams sit out at the far corners. The
 * portrait (mobile-download) canvas keeps its inset on all sides by
 * default: it's still cover-cropped by some native OS "set as wallpaper"
 * flows outside this app's own display, where a phone's true screen ratio
 * commonly doesn't match this fixed canvas. `flush` opts a portrait canvas
 * into the same 4-edge placement as desktop -- used for the dedicated
 * frame-mode canvas, which (like desktop) is only ever shown uncropped
 * inside this app's own object-fit: contain display, never downloaded to
 * be cover-cropped elsewhere.
 */
export function buildPlanetDiagramsMarkup(astrology: StructuredAstrologyData, width: number, height: number, flush = false): string {
  const size = Math.max(100, Math.min(190, Math.round(Math.min(width, height) * 0.17)));
  const isPortrait = height > width;
  const margin = isPortrait && !flush ? Math.round(Math.min(width, height) * 0.12) : 0;

  return DIAGRAMS.map((spec, i) => {
    const x = spec.corner.endsWith("left") ? margin : width - margin - size;
    const y = spec.corner.startsWith("top") ? margin : height - margin - size;
    return diagramGroup(spec, x, y, size, astrology, `pd${i}`);
  }).join("");
}
