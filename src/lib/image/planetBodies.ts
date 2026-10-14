// Stylized SVG renderings of the nine grahas -- the Sun, Moon, planets and
// the shadow nodes Rahu and Ketu. No imports, so both the server-side
// wallpaper overlays and the client-side birth form can draw the exact
// same bodies.

export type DiagramPlanet = "sun" | "moon" | "saturn" | "mars";
export type PlanetBody = DiagramPlanet | "mercury" | "jupiter" | "venus" | "rahu" | "ketu";

/**
 * How far each body's drawing reaches from its center, in units of r:
 * sideways and up/down (the Sun's rays, Saturn's ring, Rahu's corona).
 * Callers fitting a body into a box size r from these.
 */
export const PLANET_BODY_EXTENT: Record<PlanetBody, { wide: number; tall: number }> = {
  sun: { wide: 1.45, tall: 1.45 },
  moon: { wide: 1, tall: 1 },
  mars: { wide: 1, tall: 1 },
  mercury: { wide: 1, tall: 1 },
  jupiter: { wide: 1, tall: 1 },
  venus: { wide: 1, tall: 1 },
  saturn: { wide: 2, tall: 1.2 },
  rahu: { wide: 1.15, tall: 1.15 },
  ketu: { wide: 1, tall: 1 },
};

/** A small, stylized rendering of each body's real appearance, sized to fit an r-radius circle. */
export function planetBodyMarkup(planet: PlanetBody, id: string, r: number, moonIllumination: number): string {
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
      // The dark rect covers the unlit (1 - illum) share of the disc from the
      // left edge; its right edge sits at -r + (1 - illum) * 2r.
      const shadowX = -r - illum * 2 * r;
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
          <rect x="${shadowX.toFixed(1)}" y="${-r}" width="${(r * 2).toFixed(1)}" height="${(r * 2).toFixed(1)}" fill="#1b1f2e" opacity="0.72" />
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
    case "mercury":
      return `
        <defs>
          <radialGradient id="${id}" cx="38%" cy="32%" r="70%">
            <stop offset="0%" stop-color="#e4e0d8" />
            <stop offset="100%" stop-color="#77716a" />
          </radialGradient>
        </defs>
        <circle r="${r}" fill="url(#${id})" />
        <circle cx="${(-r * 0.32).toFixed(1)}" cy="${(-r * 0.12).toFixed(1)}" r="${(r * 0.17).toFixed(1)}" fill="#5f5a54" opacity="0.45" />
        <circle cx="${(r * 0.3).toFixed(1)}" cy="${(r * 0.32).toFixed(1)}" r="${(r * 0.12).toFixed(1)}" fill="#5f5a54" opacity="0.4" />
        <circle cx="${(r * 0.22).toFixed(1)}" cy="${(-r * 0.42).toFixed(1)}" r="${(r * 0.08).toFixed(1)}" fill="#5f5a54" opacity="0.4" />`;
    case "jupiter":
      // Cream and tan cloud bands, with the Great Red Spot.
      return `
        <defs>
          <radialGradient id="${id}" cx="38%" cy="32%" r="70%">
            <stop offset="0%" stop-color="#f7e6c8" />
            <stop offset="100%" stop-color="#b98450" />
          </radialGradient>
          <clipPath id="${id}-clip"><circle r="${r}" /></clipPath>
        </defs>
        <g clip-path="url(#${id}-clip)">
          <circle r="${r}" fill="url(#${id})" />
          ${[-0.55, -0.18, 0.2, 0.55]
            .map((fy, k) => `<rect x="${-r}" y="${(r * fy - r * (k % 2 ? 0.07 : 0.1)).toFixed(1)}" width="${(r * 2).toFixed(1)}" height="${(r * (k % 2 ? 0.14 : 0.2)).toFixed(1)}" fill="#9c5f33" opacity="${k % 2 ? 0.35 : 0.5}" />`)
            .join("")}
          <ellipse cx="${(r * 0.3).toFixed(1)}" cy="${(r * 0.35).toFixed(1)}" rx="${(r * 0.22).toFixed(1)}" ry="${(r * 0.12).toFixed(1)}" fill="#b5442a" opacity="0.8" />
        </g>`;
    case "venus":
      // Pale and cloud-covered.
      return `
        <defs>
          <radialGradient id="${id}" cx="38%" cy="32%" r="70%">
            <stop offset="0%" stop-color="#fffbe8" />
            <stop offset="100%" stop-color="#d8b46a" />
          </radialGradient>
          <clipPath id="${id}-clip"><circle r="${r}" /></clipPath>
        </defs>
        <g clip-path="url(#${id}-clip)">
          <circle r="${r}" fill="url(#${id})" />
          <ellipse cx="${(-r * 0.1).toFixed(1)}" cy="${(-r * 0.2).toFixed(1)}" rx="${(r * 0.9).toFixed(1)}" ry="${(r * 0.12).toFixed(1)}" fill="#fff6dc" opacity="0.45" transform="rotate(-12)" />
          <ellipse cx="${(r * 0.15).toFixed(1)}" cy="${(r * 0.3).toFixed(1)}" rx="${(r * 0.8).toFixed(1)}" ry="${(r * 0.1).toFixed(1)}" fill="#c99a4c" opacity="0.35" transform="rotate(-12)" />
        </g>`;
    case "rahu":
      // The eclipsing shadow: a dark disc ringed by a smoky violet corona.
      return `
        <defs>
          <radialGradient id="${id}" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stop-color="#8f6bff" stop-opacity="0" />
            <stop offset="86%" stop-color="#b9a0ff" stop-opacity="0.9" />
            <stop offset="100%" stop-color="#6a4fd0" stop-opacity="0" />
          </radialGradient>
        </defs>
        <circle r="${(r * 1.15).toFixed(1)}" fill="url(#${id})" />
        <circle r="${(r * 0.85).toFixed(1)}" fill="#14111f" stroke="#cbb8ff" stroke-opacity="0.85" stroke-width="${Math.max(1, r * 0.08).toFixed(1)}" />`;
    case "ketu": {
      // The comet-like tail of the nodes: a bright head trailing a fading tail.
      const hx = r * 0.42;
      const hy = -r * 0.42;
      const hr = r * 0.4;
      return `
        <defs>
          <linearGradient id="${id}" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffb46b" stop-opacity="0.95" />
            <stop offset="100%" stop-color="#ff7a3d" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path d="M${(hx - hr * 0.71).toFixed(1)} ${(hy - hr * 0.71).toFixed(1)} L${(-r * 0.95).toFixed(1)} ${(r * 0.95).toFixed(1)} L${(hx + hr * 0.71).toFixed(1)} ${(hy + hr * 0.71).toFixed(1)} Z" fill="url(#${id})" />
        <circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${hr.toFixed(1)}" fill="#fff0d6" stroke="#ffb46b" stroke-width="${Math.max(1, r * 0.08).toFixed(1)}" />`;
    }
  }
}

/** The body for a graha's English name ("Sun", "Rahu", ...), if it has one. */
export function planetBodyFor(name: string): PlanetBody | undefined {
  const key = name.toLowerCase();
  return key in PLANET_BODY_EXTENT ? (key as PlanetBody) : undefined;
}

/**
 * A body fitted into a w x h box, centered on (cx, cy): as large as its
 * extent (rays, ring, corona) allows. `id` must be unique in the document.
 */
export function fittedPlanetBodyMarkup(planet: PlanetBody, id: string, cx: number, cy: number, w: number, h: number, moonIllumination: number): string {
  const { wide, tall } = PLANET_BODY_EXTENT[planet];
  const r = Math.min(w / 2 / wide, h / 2 / tall);
  return `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})">${planetBodyMarkup(planet, id, r, moonIllumination)}</g>`;
}
