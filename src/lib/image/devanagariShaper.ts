import fs from "node:fs";
import path from "node:path";

// Runtime Devanagari (Nepali) text shaping for the wallpaper's Panchang
// summary. Sharp's SVG rasterizer has no system fonts in production, so a
// plain <text> element renders as empty boxes there -- that's why every
// other piece of wallpaper text is either the hand-built Latin vector font
// (vectorFont.ts) or, for the kundli's small FIXED vocabulary of planet
// labels, glyphs pre-shaped once at build time (devanagariLabels.ts). The
// Panchang summary is a fresh LLM sentence every day, so there's no fixed
// vocabulary to pre-shape -- instead it's shaped here, at request time,
// with real HarfBuzz shaping (correct conjuncts and matras, not naive
// character-by-character placement) using Noto Sans Devanagari (Copyright
// 2022 The Noto Project Authors, SIL Open Font License 1.1 -- see
// fonts/NotoSansDevanagari-OFL.txt). HarfBuzz is pure WASM, so this needs
// no system font install and runs the same in any Node.js environment.
// Results are cached in Redis alongside the rest of the day's Panchang
// insight (see panchangInsight.ts), so this only actually runs once per
// (date, location), not per page view.

export interface ShapedText {
  /** Advance width, in units of the font size (cap-height/em = 1). */
  width: number;
  /** SVG path data, left edge at x=0, baseline at y=0, y growing downward. */
  d: string;
}

interface ShaperState {
  hb: typeof import("harfbuzzjs");
  font: InstanceType<typeof import("harfbuzzjs").Font>;
  upem: number;
}

let statePromise: Promise<ShaperState> | null = null;

async function getState(): Promise<ShaperState> {
  if (!statePromise) {
    statePromise = (async () => {
      const hb = await import("harfbuzzjs");
      const fontPath = path.join(process.cwd(), "src/lib/image/fonts/NotoSansDevanagari.ttf");
      const data = fs.readFileSync(fontPath);
      const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      const blob = new hb.Blob(arrayBuffer);
      const face = new hb.Face(blob);
      const font = new hb.Font(face);
      return { hb, font, upem: face.upem };
    })();
  }
  return statePromise;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Re-emits glyphToPath's absolute M/L/Q/C/Z font-unit (y-up) path as em-unit (y-down) path data, offset by (dx, dy) font units. */
function transformPath(rawPath: string, dx: number, dy: number, upem: number): string {
  const tokens = rawPath.match(/[MLQCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  let out = "";
  let pair: number[] = [];
  for (const token of tokens) {
    if (/^[MLQCZ]$/i.test(token)) {
      out += token;
      pair = [];
      continue;
    }
    pair.push(Number(token));
    if (pair.length === 2) {
      const [x, y] = pair;
      out += `${round((x + dx) / upem)} ${round(-(y + dy) / upem)} `;
      pair = [];
    }
  }
  return out.trim().replace(/ ([MLQCZ])/g, "$1");
}

/** Shapes one line of (Devanagari, or mixed Devanagari/Latin/digit) text. */
export async function shapeDevanagariText(text: string): Promise<ShapedText> {
  const { hb, font, upem } = await getState();
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  hb.shape(font, buffer);
  const infos = buffer.getGlyphInfos();
  const positions = buffer.getGlyphPositions();
  let pen = 0;
  let d = "";
  infos.forEach((info, i) => {
    const pos = positions[i];
    d += transformPath(font.glyphToPath(info.codepoint), pen + pos.xOffset, pos.yOffset, upem);
    pen += pos.xAdvance;
  });
  return { width: pen / upem, d };
}

/**
 * Greedily wraps `text` into lines whose shaped width (at `fontSize`) is
 * no more than `maxWidth`, breaking on spaces -- the Devanagari analog of
 * vectorFont.ts's wrapVectorText, but each line needs an actual shape call
 * to know its true width (conjuncts/matras don't sum from per-character
 * widths the way the Latin vector font's fixed advances do).
 */
export async function shapeDevanagariLines(text: string, maxWidth: number, fontSize: number): Promise<ShapedText[]> {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const { width } = await shapeDevanagariText(candidate);
    if (current && width * fontSize > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return Promise.all(lines.map((line) => shapeDevanagariText(line)));
}
