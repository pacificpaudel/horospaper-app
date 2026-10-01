// The wallpaper's Latin text, drawn as filled outlines rather than <text>:
// sharp's SVG rasterizer (librsvg) runs in a serverless environment with no
// system fonts installed, and testing confirmed it also ignores embedded
// @font-face data -- text falls back to whatever font (or none) fontconfig
// can find, which renders as tofu boxes there. The outlines are Noto Sans's
// Latin capitals, digits and punctuation, pre-extracted into latinGlyphs.ts
// (scripts/writeLatinGlyphs.ts), so they rasterize identically everywhere.
// Uppercase only (text is upper-cased here). Glyphs are set slightly
// condensed so lines keep roughly the widths the layouts were tuned for.

import { CLEAR_GLYPHS, CLEAR_SPACE_WIDTH, LATIN_GLYPHS, LATIN_SPACE_WIDTH, LatinGlyph } from "./latinGlyphs";

/**
 * The two faces: Noto Sans (default), set slightly condensed and
 * emboldened per style; and "clear", Atkinson Hyperlegible Bold, a face
 * built for legibility, set at its natural width and weight (the Luck
 * Chart and its Analysis panel).
 */
const FACES = {
  default: { glyphs: LATIN_GLYPHS, space: LATIN_SPACE_WIDTH, condense: 0.84, emboldens: true },
  clear: { glyphs: CLEAR_GLYPHS, space: CLEAR_SPACE_WIDTH, condense: 1, emboldens: false },
} satisfies Record<string, { glyphs: Record<string, LatinGlyph>; space: number; condense: number; emboldens: boolean }>;
/** Share of a style's `tracking` actually applied (real glyphs carry their own side bearings). */
const TRACKING_SHARE = 0.35;

export interface TextStyle {
  color?: string;
  /** Opacity in [0, 1]; drawn via the wrapping <g>, not per-glyph. */
  opacity?: number;
  /**
   * Weight, as a fraction of the glyph size (cap-height): about 0.1 is the
   * font's regular weight, larger values embolden it with an outline in
   * the same colour.
   */
  strokeWidth?: number;
  /** Extra space between glyphs, as a fraction of the glyph size. */
  tracking?: number;
  /** "clear": Atkinson Hyperlegible Bold instead of Noto Sans (see FACES). */
  face?: keyof typeof FACES;
}

const faceOf = (style: TextStyle) => FACES[style.face ?? "default"];
const advanceOf = (face: (typeof FACES)[keyof typeof FACES], ch: string) => (face.glyphs[ch]?.width ?? face.space) * face.condense;

/** Measures the advance width (in px) of `text` at the given cap-height `size`, without rendering it. */
export function measureVectorText(text: string, size: number, style: TextStyle = {}): number {
  const face = faceOf(style);
  const tracking = (style.tracking ?? 0.16) * TRACKING_SHARE * size;
  let width = 0;
  for (const ch of text.toUpperCase()) width += advanceOf(face, ch) * size + tracking;
  return Math.max(0, width - tracking);
}

/** Renders `text` as an SVG fragment with its left edge at (x, y=cap-top). */
export function buildVectorTextMarkup(text: string, x: number, y: number, size: number, style: TextStyle = {}): string {
  const color = style.color ?? "#ffffff";
  const opacity = style.opacity ?? 1;
  const tracking = (style.tracking ?? 0.16) * TRACKING_SHARE * size;
  const face = faceOf(style);
  // Outline in glyph units (the path is scaled by `size`), so it emboldens evenly.
  const bold = face.emboldens ? Math.max(0, ((style.strokeWidth ?? 0.075) - 0.1) * 0.5) : 0;

  let cursor = x;
  let body = "";
  for (const ch of text.toUpperCase()) {
    const glyph = face.glyphs[ch];
    if (glyph?.d) {
      body += `<path d="${glyph.d}" transform="translate(${cursor.toFixed(1)} ${y.toFixed(1)}) scale(${(size * face.condense).toFixed(2)} ${size.toFixed(2)})" />`;
    }
    cursor += advanceOf(face, ch) * size + tracking;
  }
  const outline = bold > 0 ? ` stroke="${color}" stroke-width="${bold.toFixed(3)}" stroke-linejoin="round"` : "";
  return `<g opacity="${opacity}" fill="${color}"${outline}>${body}</g>`;
}

/**
 * Greedily wraps `text` into lines no wider than `maxWidth` at `size`,
 * breaking on spaces. A single word wider than `maxWidth` still gets its
 * own line (never split mid-word). Used for prose (the Panchang summary)
 * where a single fitSize shrink would make the text illegibly small.
 */
export function wrapVectorText(text: string, maxWidth: number, size: number, style: TextStyle = {}): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measureVectorText(candidate, size, style) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Renders `text` horizontally centered on `centerX`, with its top at `y`. */
export function buildCenteredVectorTextMarkup(text: string, centerX: number, y: number, size: number, style: TextStyle = {}): string {
  const width = measureVectorText(text, size, style);
  return buildVectorTextMarkup(text, centerX - width / 2, y, size, style);
}
