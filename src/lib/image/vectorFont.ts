// A hand-built, single-stroke display alphabet, for the exact same reason
// luckMeterOverlay.ts hand-draws its digits: sharp's SVG rasterizer
// (librsvg) runs in a serverless environment with no system fonts
// installed, and testing confirmed it also ignores embedded @font-face
// data -- text falls back to whatever font (or none) fontconfig can find,
// which renders as tofu boxes there. Every glyph below is plain line/arc
// geometry, so it rasterizes identically everywhere. Uppercase + digits
// only (callers should upper-case their text), matching a small
// architectural/deco display face rather than trying to cover a full
// typeface.

type Point = [number, number];
interface Glyph {
  /** Advance width, in units of the glyph's own em (cap-height = 1). */
  width: number;
  strokes: Point[][];
}

/** Points along an elliptical arc; angle 0=right, 90=down, 180=left, 270=up (y grows downward). */
function arc(cx: number, cy: number, rx: number, ry: number, fromDeg: number, toDeg: number, steps: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const deg = fromDeg + ((toDeg - fromDeg) * i) / steps;
    const rad = (deg * Math.PI) / 180;
    points.push([cx + rx * Math.cos(rad), cy + ry * Math.sin(rad)]);
  }
  return points;
}

const GLYPHS: Record<string, Glyph> = {
  A: { width: 0.62, strokes: [[[0, 1], [0.31, 0], [0.62, 1]], [[0.14, 0.62], [0.48, 0.62]]] },
  B: {
    width: 0.56,
    strokes: [
      [[0.06, 0], [0.06, 1]],
      [[0.06, 0], [0.32, 0], ...arc(0.32, 0.24, 0.24, 0.24, -90, 90, 8), [0.06, 0.48]],
      [[0.06, 0.5], [0.34, 0.5], ...arc(0.34, 0.74, 0.26, 0.26, -90, 90, 8), [0.06, 1]],
    ],
  },
  C: { width: 0.58, strokes: [arc(0.32, 0.5, 0.26, 0.5, 45, 315, 14)] },
  D: { width: 0.58, strokes: [[[0.06, 0], [0.06, 1]], [[0.06, 0], [0.26, 0], ...arc(0.26, 0.5, 0.26, 0.5, -90, 90, 14), [0.06, 1]]] },
  E: { width: 0.52, strokes: [[[0.5, 0], [0.06, 0], [0.06, 1], [0.5, 1]], [[0.06, 0.5], [0.4, 0.5]]] },
  F: { width: 0.5, strokes: [[[0.5, 0], [0.06, 0], [0.06, 1]], [[0.06, 0.5], [0.4, 0.5]]] },
  G: { width: 0.6, strokes: [arc(0.32, 0.5, 0.26, 0.5, 45, 350, 16), [[0.58, 0.56], [0.32, 0.56]]] },
  H: { width: 0.6, strokes: [[[0.06, 0], [0.06, 1]], [[0.54, 0], [0.54, 1]], [[0.06, 0.5], [0.54, 0.5]]] },
  I: { width: 0.22, strokes: [[[0.11, 0], [0.11, 1]]] },
  J: { width: 0.46, strokes: [[[0.4, 0], [0.4, 0.72], ...arc(0.2, 0.72, 0.2, 0.26, 0, 110, 8)]] },
  K: { width: 0.58, strokes: [[[0.06, 0], [0.06, 1]], [[0.52, 0], [0.06, 0.52], [0.54, 1]]] },
  L: { width: 0.48, strokes: [[[0.08, 0], [0.08, 1], [0.46, 1]]] },
  M: { width: 0.78, strokes: [[[0.04, 1], [0.04, 0], [0.39, 0.62], [0.74, 0], [0.74, 1]]] },
  N: { width: 0.62, strokes: [[[0.06, 1], [0.06, 0], [0.56, 1], [0.56, 0]]] },
  O: { width: 0.62, strokes: [arc(0.31, 0.5, 0.27, 0.5, 0, 360, 20)] },
  P: { width: 0.54, strokes: [[[0.06, 1], [0.06, 0], [0.28, 0], ...arc(0.28, 0.26, 0.24, 0.26, -90, 90, 10), [0.06, 0.52]]] },
  Q: { width: 0.62, strokes: [arc(0.31, 0.48, 0.27, 0.48, 0, 360, 20), [[0.32, 0.66], [0.6, 1]]] },
  R: {
    width: 0.56,
    strokes: [
      [[0.06, 1], [0.06, 0], [0.28, 0], ...arc(0.28, 0.26, 0.24, 0.26, -90, 90, 10), [0.06, 0.52]],
      [[0.22, 0.52], [0.54, 1]],
    ],
  },
  S: { width: 0.5, strokes: [[...arc(0.28, 0.25, 0.22, 0.25, 270, 90, 10), ...arc(0.22, 0.75, 0.24, 0.25, -90, 90, 10)]] },
  T: { width: 0.56, strokes: [[[0.02, 0], [0.54, 0]], [[0.28, 0], [0.28, 1]]] },
  U: { width: 0.6, strokes: [[[0.06, 0], [0.06, 0.68], ...arc(0.3, 0.68, 0.24, 0.24, 180, 0, 12), [0.54, 0]]] },
  V: { width: 0.6, strokes: [[[0.03, 0], [0.3, 1], [0.57, 0]]] },
  W: { width: 0.86, strokes: [[[0.02, 0], [0.22, 1], [0.43, 0.3], [0.64, 1], [0.84, 0]]] },
  X: { width: 0.58, strokes: [[[0.04, 0], [0.54, 1]], [[0.54, 0], [0.04, 1]]] },
  Y: { width: 0.58, strokes: [[[0.03, 0], [0.29, 0.52], [0.55, 0]], [[0.29, 0.52], [0.29, 1]]] },
  Z: { width: 0.56, strokes: [[[0.02, 0], [0.52, 0], [0.05, 1], [0.54, 1]]] },
  "0": { width: 0.56, strokes: [arc(0.28, 0.5, 0.24, 0.48, 0, 360, 20), [[0.14, 0.76], [0.42, 0.24]]] },
  "1": { width: 0.34, strokes: [[[0.06, 0.18], [0.2, 0], [0.2, 1]], [[0.06, 1], [0.32, 1]]] },
  "2": { width: 0.5, strokes: [[...arc(0.25, 0.22, 0.2, 0.22, 200, 340, 10), [0.05, 1], [0.5, 1]]] },
  "3": { width: 0.5, strokes: [arc(0.22, 0.24, 0.22, 0.24, -90, 100, 10), arc(0.2, 0.75, 0.24, 0.26, -95, 90, 10)] },
  "4": { width: 0.58, strokes: [[[0.42, 1], [0.42, 0], [0.04, 0.68], [0.54, 0.68]]] },
  "5": { width: 0.5, strokes: [[[0.46, 0], [0.06, 0], [0.03, 0.46], [0.24, 0.42], ...arc(0.24, 0.72, 0.24, 0.28, -90, 130, 12)]] },
  "6": { width: 0.54, strokes: [[[0.42, 0.05], [0.124, 0.55]], arc(0.28, 0.72, 0.22, 0.24, 0, 360, 18)] },
  "7": { width: 0.5, strokes: [[[0.02, 0], [0.48, 0], [0.16, 1]]] },
  "8": { width: 0.52, strokes: [arc(0.26, 0.26, 0.2, 0.24, 0, 360, 14), arc(0.26, 0.74, 0.22, 0.26, 0, 360, 14)] },
  "9": { width: 0.54, strokes: [[[0.14, 0.96], [0.36, 0.66], ...arc(0.26, 0.28, 0.24, 0.26, 20, 320, 14)]] },
  // Parentheses mark retrograde planets in the kundli, e.g. "(SA)".
  "(": { width: 0.26, strokes: [arc(0.3, 0.5, 0.2, 0.55, 125, 235, 10)] },
  ")": { width: 0.26, strokes: [arc(-0.04, 0.5, 0.2, 0.55, -55, 55, 10)] },
  // For the kundli's "CURRENT MAHADASHA: SUN (2023-2029)" header.
  ":": { width: 0.2, strokes: [arc(0.1, 0.3, 0.04, 0.04, 0, 360, 8), arc(0.1, 0.85, 0.04, 0.04, 0, 360, 8)] },
  "-": { width: 0.38, strokes: [[[0.05, 0.55], [0.33, 0.55]]] },
  // Middle dot separator, e.g. "HOPEFUL · PROSPERITY".
  "·": { width: 0.24, strokes: [arc(0.12, 0.5, 0.05, 0.05, 0, 360, 8)] },
};

const SPACE_WIDTH = 0.34;

export interface TextStyle {
  color?: string;
  /** Opacity in [0, 1]; drawn via the wrapping <g>, not per-stroke. */
  opacity?: number;
  /** Stroke width as a fraction of the glyph size (cap-height). */
  strokeWidth?: number;
  /** Extra space between glyphs, as a fraction of the glyph size. */
  tracking?: number;
}

function glyphMarkup(glyph: Glyph, originX: number, originY: number, size: number, color: string, strokeWidthPx: number): string {
  return glyph.strokes
    .map((stroke) => {
      const d = stroke
        .map(([x, y], i) => `${i === 0 ? "M" : "L"}${(originX + x * size).toFixed(1)} ${(originY + y * size).toFixed(1)}`)
        .join(" ");
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeWidthPx.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .join("");
}

/** Measures the advance width (in px) of `text` at the given cap-height `size`, without rendering it. */
export function measureVectorText(text: string, size: number, style: TextStyle = {}): number {
  const tracking = (style.tracking ?? 0.16) * size;
  let width = 0;
  for (const ch of text.toUpperCase()) {
    const glyph = GLYPHS[ch];
    width += ch === " " || !glyph ? SPACE_WIDTH * size : glyph.width * size;
    width += tracking;
  }
  return Math.max(0, width - tracking);
}

/** Renders `text` (uppercase letters, digits, spaces) as an SVG fragment with its left edge at (x, y=cap-top). */
export function buildVectorTextMarkup(text: string, x: number, y: number, size: number, style: TextStyle = {}): string {
  const color = style.color ?? "#ffffff";
  const opacity = style.opacity ?? 1;
  const strokeWidthPx = (style.strokeWidth ?? 0.075) * size;
  const tracking = (style.tracking ?? 0.16) * size;

  let cursor = x;
  let body = "";
  for (const ch of text.toUpperCase()) {
    if (ch === " " || !GLYPHS[ch]) {
      cursor += SPACE_WIDTH * size + tracking;
      continue;
    }
    const glyph = GLYPHS[ch];
    body += glyphMarkup(glyph, cursor, y, size, color, strokeWidthPx);
    cursor += glyph.width * size + tracking;
  }
  return `<g opacity="${opacity}">${body}</g>`;
}

/** Renders `text` horizontally centered on `centerX`, with its top at `y`. */
export function buildCenteredVectorTextMarkup(text: string, centerX: number, y: number, size: number, style: TextStyle = {}): string {
  const width = measureVectorText(text, size, style);
  return buildVectorTextMarkup(text, centerX - width / 2, y, size, style);
}
