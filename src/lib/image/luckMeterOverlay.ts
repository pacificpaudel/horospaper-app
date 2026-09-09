// Sharp's SVG rasterizer (librsvg) runs in a serverless environment with no
// system fonts installed, so any <text> element renders as empty tofu boxes
// there (it looks fine in a browser, which is what made this easy to miss).
// The percentage is drawn as hand-built vector segments instead -- no font
// dependency, so it renders identically everywhere.
const SEGMENTS: Record<string, string[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "g", "c", "d"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "g", "e", "c", "d"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
};

/** One digit as 7-segment-style rounded bars, in a `w`x`h` cell at (x, y). */
function digitMarkup(digit: string, x: number, y: number, w: number, h: number, color: string): string {
  const segs = SEGMENTS[digit];
  if (!segs) return "";
  const t = w * 0.24;
  const half = h / 2;
  const parts: string[] = [];
  const hSeg = (sy: number) =>
    `<rect x="${(x + t * 0.55).toFixed(1)}" y="${(sy - t / 2).toFixed(1)}" width="${(w - t * 1.1).toFixed(1)}" height="${t.toFixed(1)}" rx="${(t / 2).toFixed(1)}" fill="${color}" />`;
  const vSeg = (sy0: number, sy1: number, right: boolean) =>
    `<rect x="${(x + (right ? w - t / 2 : -t / 2)).toFixed(1)}" y="${(sy0 + t * 0.55).toFixed(1)}" width="${t.toFixed(1)}" height="${(sy1 - sy0 - t * 1.1).toFixed(1)}" rx="${(t / 2).toFixed(1)}" fill="${color}" />`;
  if (segs.includes("a")) parts.push(hSeg(y));
  if (segs.includes("g")) parts.push(hSeg(y + half));
  if (segs.includes("d")) parts.push(hSeg(y + h));
  if (segs.includes("f")) parts.push(vSeg(y, y + half, false));
  if (segs.includes("b")) parts.push(vSeg(y, y + half, true));
  if (segs.includes("e")) parts.push(vSeg(y + half, y + h, false));
  if (segs.includes("c")) parts.push(vSeg(y + half, y + h, true));
  return parts.join("");
}

/** A "%" glyph: two small circles and a diagonal stroke, sized to a `w`x`h` cell. */
function percentMarkup(x: number, y: number, w: number, h: number, color: string): string {
  const r = w * 0.16;
  const strokeW = Math.max(2, w * 0.13);
  return `
    <line x1="${(x + w * 0.12).toFixed(1)}" y1="${(y + h).toFixed(1)}" x2="${(x + w * 0.88).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="${strokeW.toFixed(1)}" stroke-linecap="round" />
    <circle cx="${(x + r).toFixed(1)}" cy="${(y + r).toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${strokeW.toFixed(1)}" />
    <circle cx="${(x + w - r).toFixed(1)}" cy="${(y + h - r).toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${strokeW.toFixed(1)}" />`;
}

/**
 * Draws the luck-meter progress bar with its percentage near the
 * bottom-center of a `width`x`height` canvas, so the downloaded wallpaper
 * always includes it instead of it only existing as a page overlay.
 */
export function buildLuckMeterMarkup(width: number, height: number, luckScore: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(luckScore)));
  const digits = String(clamped);
  const minDim = Math.min(width, height);
  const barWidth = Math.min(width * 0.36, 440);
  const barHeight = Math.max(8, Math.round(minDim * 0.011));
  const bottomMargin = Math.round(minDim * 0.065);
  const barY = height - bottomMargin;
  const left = width / 2 - barWidth / 2;
  const fillWidth = (barWidth * clamped) / 100;

  const digitH = barHeight * 3.4;
  const digitW = digitH * 0.52;
  const gap = digitW * 0.32;
  const percentW = digitW * 0.85;
  const totalW = digits.length * (digitW + gap) + percentW;
  const startX = width / 2 - totalW / 2;
  const digitY = barY - barHeight * 1.6 - digitH;

  let cursor = startX;
  const color = "#f7c56a";
  const glyphs = digits
    .split("")
    .map((d) => {
      const markup = digitMarkup(d, cursor, digitY, digitW, digitH, color);
      cursor += digitW + gap;
      return markup;
    })
    .join("");
  const percentGlyph = percentMarkup(cursor, digitY + digitH * 0.15, percentW, digitH * 0.7, color);

  const padX = 32;
  const padTop = digitH * 0.35;
  const padBottom = barHeight * 1.8;

  return `
  <g>
    <rect x="${(left - padX).toFixed(1)}" y="${(digitY - padTop).toFixed(1)}" width="${(barWidth + padX * 2).toFixed(1)}" height="${(barY - digitY + padTop + padBottom).toFixed(1)}" rx="20" fill="#0b1220" fill-opacity="0.46" />
    ${glyphs}
    ${percentGlyph}
    <rect x="${left.toFixed(1)}" y="${barY.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight}" rx="${(barHeight / 2).toFixed(1)}" fill="#ffffff" fill-opacity="0.1" stroke="#f7c56a" stroke-opacity="0.35" stroke-width="1" />
    <defs>
      <linearGradient id="luckMeterFill" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#e97855" />
        <stop offset="100%" stop-color="#f7c56a" />
      </linearGradient>
    </defs>
    <rect x="${left.toFixed(1)}" y="${barY.toFixed(1)}" width="${fillWidth.toFixed(1)}" height="${barHeight}" rx="${(barHeight / 2).toFixed(1)}" fill="url(#luckMeterFill)" />
  </g>`;
}
