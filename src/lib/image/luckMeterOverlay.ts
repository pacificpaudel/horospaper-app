// Sharp's SVG rasterizer (librsvg) runs in a serverless environment with no
// system fonts installed, so any <text> element renders as empty tofu boxes
// there (it looks fine in a browser, which is what made this easy to miss).
// The percentage is drawn with the app's own hand-built vector font (see
// vectorFont.ts) instead -- no font dependency, so it renders identically
// everywhere, in the same plain lettering as the rest of the wallpaper
// (previously a chunky 7-segment "LED" style, kept only for this one label).
import { buildCenteredVectorTextMarkup, measureVectorText, TextStyle } from "./vectorFont";

/** Top edge of the luck meter's backdrop panel -- other overlays stack above it. */
export function luckMeterTop(width: number, height: number): number {
  const minDim = Math.min(width, height);
  const barHeight = Math.max(8, Math.round(minDim * 0.011));
  const barY = height - Math.round(minDim * 0.065);
  const digitH = barHeight * 3.4;
  const digitY = barY - barHeight * 1.6 - digitH;
  return digitY - digitH * 0.35;
}

/**
 * Draws the luck-meter progress bar with its percentage near the
 * bottom-center of a `width`x`height` canvas, so the downloaded wallpaper
 * always includes it instead of it only existing as a page overlay.
 */
export function buildLuckMeterMarkup(width: number, height: number, luckScore: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(luckScore)));
  const text = `${clamped}%`;
  const minDim = Math.min(width, height);
  const barWidth = Math.min(width * 0.36, 440);
  const barHeight = Math.max(8, Math.round(minDim * 0.011));
  const bottomMargin = Math.round(minDim * 0.065);
  const barY = height - bottomMargin;
  const left = width / 2 - barWidth / 2;
  const fillWidth = (barWidth * clamped) / 100;

  // digitH kept as the label's height budget (unchanged from the old LED
  // digits) so the panel's overall size -- and luckMeterTop()'s promise to
  // other overlays -- doesn't shift.
  const digitH = barHeight * 3.4;
  const digitY = barY - barHeight * 1.6 - digitH;
  const style: TextStyle = { color: "#f7c56a", strokeWidth: 0.1, tracking: 0.05 };
  const textWidth = measureVectorText(text, digitH, style);
  const label = buildCenteredVectorTextMarkup(text, width / 2, digitY, digitH, style);

  const padX = 32;
  const padTop = digitH * 0.35;
  const padBottom = barHeight * 1.8;
  const panelHalfWidth = Math.max(barWidth / 2, textWidth / 2) + padX;

  return `
  <g>
    <rect x="${(width / 2 - panelHalfWidth).toFixed(1)}" y="${(digitY - padTop).toFixed(1)}" width="${(panelHalfWidth * 2).toFixed(1)}" height="${(barY - digitY + padTop + padBottom).toFixed(1)}" rx="20" fill="#0b1220" fill-opacity="0.46" />
    ${label}
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
