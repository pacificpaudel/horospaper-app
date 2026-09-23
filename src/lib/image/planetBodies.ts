// Stylized SVG renderings of the Sun, Moon, Saturn and Mars. No imports,
// so both the server-side wallpaper overlays and the client-side birth
// form can draw the exact same bodies.

export type DiagramPlanet = "sun" | "moon" | "saturn" | "mars";

/** A small, stylized rendering of each body's real appearance, sized to fit an r-radius circle. */
export function planetBodyMarkup(planet: DiagramPlanet, id: string, r: number, moonIllumination: number): string {
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
  }
}
