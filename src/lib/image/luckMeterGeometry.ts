// The luck meter's geometry on a `width`x`height` wallpaper -- no imports,
// so the page can find the meter in the image too (the "Luck Chart" button
// sits just above it; see LuckChartLayer.tsx) without the drawing code.

/**
 * A compact panel near the bottom center: the percentage, then the bar
 * right under it. Shared by the drawing (luckMeterOverlay.ts) and
 * luckMeterTop(), so they can never disagree.
 */
export function luckMeterGeometry(width: number, height: number) {
  const minDim = Math.min(width, height);
  const barHeight = Math.max(8, Math.round(minDim * 0.011));
  const barY = height - Math.round(minDim * 0.05);
  const digitH = barHeight * 2.7;
  const digitY = barY - barHeight * 1.0 - digitH;
  const padTop = digitH * 0.28;
  const padBottom = barHeight * 1.3;
  return { minDim, barHeight, barY, digitH, digitY, padTop, padBottom, panelTop: digitY - padTop };
}

/** Top edge of the luck meter's backdrop panel -- other overlays stack above it. */
export function luckMeterTop(width: number, height: number): number {
  return luckMeterGeometry(width, height).panelTop;
}

/** The luck meter panel's box (roughly the bar's width plus padding), e.g. as a click target over the image. */
export function luckMeterPanel(width: number, height: number): { x: number; y: number; w: number; h: number; digitsTop: number } {
  const { barY, panelTop, padBottom, barHeight, digitY } = luckMeterGeometry(width, height);
  const halfWidth = Math.min(width * 0.36, 440) / 2 + 32;
  return { x: width / 2 - halfWidth, y: panelTop, w: halfWidth * 2, h: barY + barHeight + padBottom - panelTop, digitsTop: digitY };
}
