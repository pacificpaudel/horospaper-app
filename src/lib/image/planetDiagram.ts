import { StructuredAstrologyData } from "@/lib/astrology";

type DiagramPlanet = "sun" | "moon" | "saturn" | "mars";
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

/** A small, stylized rendering of each body's real appearance, sized to fit an r-radius circle. */
function planetBodyMarkup(planet: DiagramPlanet, id: string, r: number, moonIllumination: number): string {
  switch (planet) {
    case "sun":
      return `
        <defs>
          <radialGradient id="${id}" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#fff6d6" />
            <stop offset="45%" stop-color="#ffcf4d" />
            <stop offset="100%" stop-color="#e8791a" />
          </radialGradient>
        </defs>
        ${Array.from({ length: 8 })
          .map((_, i) => {
            const a = (i * Math.PI) / 4;
            const x1 = Math.cos(a) * (r * 1.25);
            const y1 = Math.sin(a) * (r * 1.25);
            const x2 = Math.cos(a) * (r * 1.7);
            const y2 = Math.sin(a) * (r * 1.7);
            return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#ffcf4d" stroke-opacity="0.55" stroke-width="${Math.max(1, r * 0.09).toFixed(1)}" stroke-linecap="round" />`;
          })
          .join("")}
        <circle r="${r}" fill="url(#${id})" />`;
    case "moon": {
      const illum = Math.max(0.04, Math.min(0.96, moonIllumination));
      const shadowX = r - illum * 2 * r;
      return `
        <defs>
          <radialGradient id="${id}" cx="38%" cy="32%" r="70%">
            <stop offset="0%" stop-color="#f4f2ea" />
            <stop offset="100%" stop-color="#a9a9ad" />
          </radialGradient>
          <clipPath id="${id}-clip"><circle r="${r}" /></clipPath>
        </defs>
        <g clip-path="url(#${id}-clip)">
          <circle r="${r}" fill="url(#${id})" />
          <circle cx="${(-r * 0.35).toFixed(1)}" cy="${(-r * 0.3).toFixed(1)}" r="${(r * 0.18).toFixed(1)}" fill="#8b8b90" opacity="0.5" />
          <circle cx="${(r * 0.3).toFixed(1)}" cy="${(r * 0.15).toFixed(1)}" r="${(r * 0.13).toFixed(1)}" fill="#8b8b90" opacity="0.4" />
          <circle cx="${(r * 0.05).toFixed(1)}" cy="${(r * 0.45).toFixed(1)}" r="${(r * 0.1).toFixed(1)}" fill="#8b8b90" opacity="0.35" />
          <rect x="${(-r + shadowX).toFixed(1)}" y="${-r}" width="${(r * 2).toFixed(1)}" height="${(r * 2).toFixed(1)}" fill="#1b1f2e" opacity="0.72" />
        </g>`;
    }
    case "saturn":
      return `
        <defs>
          <radialGradient id="${id}" cx="38%" cy="32%" r="70%">
            <stop offset="0%" stop-color="#f6e3b8" />
            <stop offset="100%" stop-color="#c99f5c" />
          </radialGradient>
        </defs>
        <ellipse rx="${(r * 2.05).toFixed(1)}" ry="${(r * 0.62).toFixed(1)}" fill="none" stroke="#e9d9ad" stroke-opacity="0.55" stroke-width="${Math.max(1.5, r * 0.18).toFixed(1)}" transform="rotate(-18)" />
        <circle r="${r}" fill="url(#${id})" />
        <path d="M ${(-r * 2.05).toFixed(1)} 0 A ${(r * 2.05).toFixed(1)} ${(r * 0.62).toFixed(1)} 0 0 0 ${(r * 2.05).toFixed(1)} 0" fill="none" stroke="#8c6f3f" stroke-opacity="0.6" stroke-width="${Math.max(1.5, r * 0.16).toFixed(1)}" transform="rotate(-18)" />`;
    case "mars":
      return `
        <defs>
          <radialGradient id="${id}" cx="38%" cy="32%" r="70%">
            <stop offset="0%" stop-color="#f2a06b" />
            <stop offset="100%" stop-color="#a3411c" />
          </radialGradient>
        </defs>
        <circle r="${r}" fill="url(#${id})" />
        <circle cx="${(-r * 0.3).toFixed(1)}" cy="${(r * 0.25).toFixed(1)}" r="${(r * 0.22).toFixed(1)}" fill="#7a2e13" opacity="0.45" />
        <circle cx="${(r * 0.32).toFixed(1)}" cy="${(-r * 0.2).toFixed(1)}" r="${(r * 0.14).toFixed(1)}" fill="#7a2e13" opacity="0.4" />`;
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
 * `width`x`height` canvas. The on-screen display always cover-crops this
 * canvas to fill whatever viewport it's shown in (so there's never a
 * letterboxed gap), and that viewport's real ratio isn't necessarily the
 * one this canvas was generated for -- a phone's true screen is usually
 * taller than the fixed 9:16 mobile canvas, and a desktop window can be
 * resized after generation. edgeMargin is therefore a real safety inset,
 * not just decorative spacing, sized to survive a reasonably different
 * crop, not just sit flush against this canvas's own raw edge.
 */
export function buildPlanetDiagramsMarkup(astrology: StructuredAstrologyData, width: number, height: number): string {
  const size = Math.max(100, Math.min(190, Math.round(Math.min(width, height) * 0.17)));
  const edgeMargin = Math.round(Math.min(width, height) * 0.05);

  return DIAGRAMS.map((spec, i) => {
    const x = spec.corner.endsWith("left") ? edgeMargin : width - edgeMargin - size;
    const y = spec.corner.startsWith("top") ? edgeMargin : height - edgeMargin - size;
    return diagramGroup(spec, x, y, size, astrology, `pd${i}`);
  }).join("");
}

/** Standalone transparent SVG overlay (for compositing onto a raster image with sharp). */
export function buildPlanetOverlaySvg(astrology: StructuredAstrologyData, width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${buildPlanetDiagramsMarkup(astrology, width, height)}</svg>`;
}
