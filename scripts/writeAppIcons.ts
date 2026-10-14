// Writes the installable app's icons (see src/app/manifest.ts) to
// public/icons/ as PNGs (and the Apple touch icon to src/app/apple-icon.png), from the crystal-ball logo on the app's own dark
// background: "any" icons with the logo filling most of the square, and
// "maskable" ones with it inside the central safe zone, so Android can
// crop them to a circle, squircle or rounded square without clipping it.
// Run after changing the logo: npx tsx scripts/writeAppIcons.ts
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const BACKGROUND = "#101322"; // --background in globals.css
const logo = fs.readFileSync(path.join(process.cwd(), "public", "horospaper-crystal-ball.svg"));
const dir = path.join(process.cwd(), "public", "icons");
fs.mkdirSync(dir, { recursive: true });

/** The logo at `share` of the side, centered on a `size`-square of the background. */
async function icon(size: number, share: number, file: string) {
  const inner = Math.round(size * share);
  const art = await sharp(logo, { density: 1200 }).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: art, gravity: "centre" }])
    .png()
    .toFile(path.isAbsolute(file) ? file : path.join(dir, file));
}

await Promise.all([
  icon(192, 0.86, "icon-192.png"),
  icon(512, 0.86, "icon-512.png"),
  // Android's maskable safe zone is the central 80% circle; the logo stays well inside it.
  icon(192, 0.62, "maskable-192.png"),
  icon(512, 0.62, "maskable-512.png"),
  // Next.js links this one itself, as the Apple touch icon.
  icon(180, 0.86, path.join(process.cwd(), "src", "app", "apple-icon.png")),
]);
console.log(`Wrote app icons to ${dir}`);
