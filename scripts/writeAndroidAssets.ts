// Writes the Android app's launcher icons and splash screens (see
// capacitor.config.ts) into android/app/src/main/res, from the
// crystal-ball logo on the app's dark background -- the same artwork as
// the web app's icons (scripts/writeAppIcons.ts), at every size and
// density Android asks for. Run after changing the logo, or after
// regenerating the android/ project: npx tsx scripts/writeAndroidAssets.ts
import fs from "node:fs";
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";

const BACKGROUND = "#101322"; // --background in globals.css
const logo = fs.readFileSync(path.join(process.cwd(), "public", "horospaper-crystal-ball.svg"));
const res = path.join(process.cwd(), "android", "app", "src", "main", "res");

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 } as const;
// Splash sizes per density, portrait (landscape is the same turned).
const SPLASH: Record<keyof typeof DENSITIES, [number, number]> = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };

const art = (side: number) => sharp(logo, { density: 1200 }).resize(side, side, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

/** The logo at `logoSide` px, centered on a width x height canvas (transparent, or the dark background). */
async function canvas(width: number, height: number, logoSide: number, file: string, filled: boolean, round = false) {
  const layers: OverlayOptions[] = [{ input: await art(logoSide), gravity: "centre" }];
  if (round) {
    // Legacy round icon: everything outside the circle cleared.
    const mask = Buffer.from(`<svg width="${width}" height="${height}"><circle cx="${width / 2}" cy="${height / 2}" r="${width / 2}" /></svg>`);
    layers.push({ input: mask, blend: "dest-in" });
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp({ create: { width, height, channels: 4, background: filled ? BACKGROUND : { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers)
    .png()
    .toFile(file);
}

const jobs: Promise<unknown>[] = [];
for (const [density, scale] of Object.entries(DENSITIES) as [keyof typeof DENSITIES, number][]) {
  const mipmap = path.join(res, `mipmap-${density}`);
  // Adaptive icon foreground: a 108dp canvas whose central 66dp always shows; the logo stays inside it.
  const fg = Math.round(108 * scale);
  jobs.push(canvas(fg, fg, Math.round(fg * 0.56), path.join(mipmap, "ic_launcher_foreground.png"), false));
  // Legacy icons (Android 7 and older): 48dp, the logo filling most of it.
  const legacy = Math.round(48 * scale);
  jobs.push(canvas(legacy, legacy, Math.round(legacy * 0.84), path.join(mipmap, "ic_launcher.png"), true));
  jobs.push(canvas(legacy, legacy, Math.round(legacy * 0.72), path.join(mipmap, "ic_launcher_round.png"), true, true));
  // Splash screens, the logo at a third of the short side.
  const [w, h] = SPLASH[density];
  jobs.push(canvas(w, h, Math.round(w / 3), path.join(res, `drawable-port-${density}`, "splash.png"), true));
  jobs.push(canvas(h, w, Math.round(w / 3), path.join(res, `drawable-land-${density}`, "splash.png"), true));
}
jobs.push(canvas(480, 320, 110, path.join(res, "drawable", "splash.png"), true));

await Promise.all(jobs);
// The adaptive icon's background layer, behind the foreground above.
fs.writeFileSync(
  path.join(res, "values", "ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BACKGROUND}</color>\n</resources>\n`
);
console.log(`Wrote launcher icons and splash screens to ${res}`);
