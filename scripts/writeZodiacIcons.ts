// Writes the 12 zodiac icons (src/lib/image/zodiacIcons.ts) to
// public/zodiac/<sign>.svg as standalone, transparent-background files.
// Run after changing an icon: npx tsx scripts/writeZodiacIcons.ts
import fs from "node:fs";
import path from "node:path";
import { ZODIAC_SIGNS, zodiacIconSvg } from "../src/lib/image/zodiacIcons";

const dir = path.join(process.cwd(), "public", "zodiac");
fs.mkdirSync(dir, { recursive: true });
for (const sign of ZODIAC_SIGNS) {
  fs.writeFileSync(path.join(dir, `${sign.toLowerCase()}.svg`), zodiacIconSvg(sign) + "\n");
}
console.log(`Wrote ${ZODIAC_SIGNS.length} icons to ${dir}`);
