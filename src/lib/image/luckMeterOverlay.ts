/**
 * Draws the "Your luck today" label + progress bar near the bottom-center
 * of a `width`x`height` canvas, so the downloaded wallpaper always includes
 * it -- matching the on-screen luck-meter panel, but baked into the file
 * itself instead of only existing as a page overlay.
 */
export function buildLuckMeterMarkup(width: number, height: number, luckScore: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(luckScore)));
  const minDim = Math.min(width, height);
  const barWidth = Math.min(width * 0.36, 440);
  const barHeight = Math.max(8, Math.round(minDim * 0.011));
  const bottomMargin = Math.round(minDim * 0.065);
  const fontSize = Math.max(12, Math.round(barHeight * 1.5));
  const cx = width / 2;
  const left = cx - barWidth / 2;
  const right = cx + barWidth / 2;
  const barY = height - bottomMargin;
  const labelY = barY - barHeight - fontSize * 0.9;
  const fillWidth = (barWidth * clamped) / 100;
  const padX = 28;
  const padTop = fontSize * 1.6;
  const padBottom = barHeight * 1.8;

  return `
  <g>
    <rect x="${(left - padX).toFixed(1)}" y="${(labelY - padTop).toFixed(1)}" width="${(barWidth + padX * 2).toFixed(1)}" height="${(barY - labelY + padTop + padBottom).toFixed(1)}" rx="18" fill="#0b1220" fill-opacity="0.46" />
    <text x="${left.toFixed(1)}" y="${labelY.toFixed(1)}" fill="#f8f0df" font-family="sans-serif" font-size="${fontSize}" letter-spacing="2" opacity="0.95">YOUR LUCK TODAY</text>
    <text x="${right.toFixed(1)}" y="${labelY.toFixed(1)}" fill="#f7c56a" font-family="sans-serif" font-size="${(fontSize * 1.15).toFixed(1)}" font-weight="700" text-anchor="end">${clamped}%</text>
    <defs>
      <linearGradient id="luckMeterFill" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#e97855" />
        <stop offset="100%" stop-color="#f7c56a" />
      </linearGradient>
    </defs>
    <rect x="${left.toFixed(1)}" y="${barY.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight}" rx="${(barHeight / 2).toFixed(1)}" fill="#ffffff" fill-opacity="0.1" stroke="#f7c56a" stroke-opacity="0.35" stroke-width="1" />
    <rect x="${left.toFixed(1)}" y="${barY.toFixed(1)}" width="${fillWidth.toFixed(1)}" height="${barHeight}" rx="${(barHeight / 2).toFixed(1)}" fill="url(#luckMeterFill)" />
  </g>`;
}
