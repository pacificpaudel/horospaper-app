// The 12 zodiac signs as original, hand-drawn vector icons: one flat
// colour per sign, on a transparent background, in a 100x100 box. Used in
// the birth-profile form (the person's rashi) and on the wallpaper, under
// the tags. Plain SVG geometry, no <text>, so they render identically in
// the browser and in sharp's font-less rasterizer. `public/zodiac/*.svg`
// holds the same icons as standalone files (scripts/writeZodiacIcons.ts).

export type ZodiacSign =
  | "Aries"
  | "Taurus"
  | "Gemini"
  | "Cancer"
  | "Leo"
  | "Virgo"
  | "Libra"
  | "Scorpio"
  | "Sagittarius"
  | "Capricorn"
  | "Aquarius"
  | "Pisces";

export const ZODIAC_SIGNS: ZodiacSign[] = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

/** One colour per sign. */
export const ZODIAC_COLORS: Record<ZodiacSign, string> = {
  Aries: "#b3b52c",
  Taurus: "#e8193c",
  Gemini: "#2f8fc4",
  Cancer: "#8e3b1e",
  Leo: "#f07b2b",
  Virgo: "#c2409f",
  Libra: "#2d43a0",
  Scorpio: "#2f3384",
  Sagittarius: "#1f5e3c",
  Capricorn: "#1f7d3c",
  Aquarius: "#2c3392",
  Pisces: "#1f6f7d",
};

/**
 * Each sign's drawing: `c` is its colour, `d` the detail colour (eyes,
 * fur and feather lines) -- the badge colour behind it, so details read
 * as cut-outs.
 */
const DRAWINGS: Record<ZodiacSign, (c: string, d: string) => string> = {
  // A ram's head, face-on, with two horns curling out and down.
  Aries: (c, d) => `
    <path d="M44 33 C38 17 18 12 11 27 C6 40 17 51 26 45 C32 41 29 32 22 34" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" />
    <path d="M56 33 C62 17 82 12 89 27 C94 40 83 51 74 45 C68 41 71 32 78 34" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" />
    <path d="M50 28 C39 28 35 38 37 50 C39 63 43 77 50 87 C57 77 61 63 63 50 C65 38 61 28 50 28 Z" fill="${c}" />
    <ellipse cx="43" cy="50" rx="2.6" ry="1.8" fill="${d}" /><ellipse cx="57" cy="50" rx="2.6" ry="1.8" fill="${d}" />
    <path d="M46 80 Q50 83 54 80" fill="none" stroke="${d}" stroke-width="1.6" stroke-linecap="round" />
    <path d="M14 27 C17 21 24 21 26 27" fill="none" stroke="${d}" stroke-width="1.5" /><path d="M86 27 C83 21 76 21 74 27" fill="none" stroke="${d}" stroke-width="1.5" />`,

  // A bull's head, face-on, horns sweeping up.
  Taurus: (c, d) => `
    <path d="M31 37 C18 33 11 21 15 6 C21 19 28 25 39 29 Z" fill="${c}" />
    <path d="M69 37 C82 33 89 21 85 6 C79 19 72 25 61 29 Z" fill="${c}" />
    <path d="M30 39 L13 42 L29 49 Z" fill="${c}" /><path d="M70 39 L87 42 L71 49 Z" fill="${c}" />
    <path d="M31 31 Q50 26 69 31 C72 45 66 57 64 69 C62 82 57 90 50 90 C43 90 38 82 36 69 C34 57 28 45 31 31 Z" fill="${c}" />
    <ellipse cx="42" cy="49" rx="3" ry="2.2" fill="${d}" /><ellipse cx="58" cy="49" rx="3" ry="2.2" fill="${d}" />
    <ellipse cx="50" cy="79" rx="11" ry="7.5" fill="none" stroke="${d}" stroke-width="1.8" />
    <ellipse cx="45.5" cy="80" rx="1.8" ry="2.4" fill="${d}" /><ellipse cx="54.5" cy="80" rx="1.8" ry="2.4" fill="${d}" />`,

  // Twin faces in profile, one behind the other.
  Gemini: (c, d) => `
    <g opacity="0.72" transform="translate(-13 4)">
      <path d="M62 14 C77 14 87 27 86 44 C85 59 80 70 76 82 L76 92 L52 92 L52 84 C47 84 44 81 44 76 L44 70 L40 68 L44 62 C42 60 42 56 44 54 L39 50 C41 44 44 40 44 34 C46 22 52 14 62 14 Z" fill="${c}" />
    </g>
    <path d="M62 10 C77 10 87 23 86 40 C85 55 80 66 76 78 L76 92 L52 92 L52 80 C47 80 44 77 44 72 L44 66 L40 64 L44 58 C42 56 42 52 44 50 L39 46 C41 40 44 36 44 30 C46 18 52 10 62 10 Z" fill="${c}" />
    <path d="M66 16 C72 24 74 34 72 46 M74 20 C80 30 81 42 78 54 M60 14 C64 20 66 28 64 36" fill="none" stroke="${d}" stroke-width="1.6" stroke-linecap="round" />
    <ellipse cx="50" cy="44" rx="2" ry="1.4" fill="${d}" />`,

  // A crab from above: round shell, two big claws, legs either side.
  Cancer: (c, d) => `
    <g fill="none" stroke="${c}" stroke-width="3.4" stroke-linecap="round">
      <path d="M30 60 L13 54 L7 62" /><path d="M30 66 L12 66 L7 75" /><path d="M32 72 L16 78 L13 88" />
      <path d="M70 60 L87 54 L93 62" /><path d="M70 66 L88 66 L93 75" /><path d="M68 72 L84 78 L87 88" />
      <path d="M38 50 L28 32" /><path d="M62 50 L72 32" />
      <path d="M45 46 L44 38" /><path d="M55 46 L56 38" />
    </g>
    <path d="M28 33 C14 32 8 18 18 10 C22 18 28 20 32 16 C34 24 33 30 28 33 Z" fill="${c}" />
    <path d="M72 33 C86 32 92 18 82 10 C78 18 72 20 68 16 C66 24 67 30 72 33 Z" fill="${c}" />
    <ellipse cx="50" cy="62" rx="22" ry="17" fill="${c}" />
    <circle cx="44" cy="37" r="3" fill="${c}" /><circle cx="56" cy="37" r="3" fill="${c}" />
    <circle cx="44" cy="37" r="1.2" fill="${d}" /><circle cx="56" cy="37" r="1.2" fill="${d}" />
    <path d="M38 60 Q50 54 62 60" fill="none" stroke="${d}" stroke-width="1.6" stroke-linecap="round" />`,

  // A lion's head in profile with a flowing mane.
  Leo: (c, d) => `
    <path d="M48 8 C62 4 74 10 80 18 C92 22 98 36 94 48 C98 60 92 74 80 80 C76 92 60 96 50 90 C42 94 34 90 32 82 C44 80 54 70 56 58 C58 44 54 30 44 24 C42 16 44 10 48 8 Z" fill="${c}" />
    <path d="M44 24 C32 23 22 30 17 40 L6 44 C4 48 5 52 8 54 L17 56 C17 66 25 74 36 74 C47 74 55 66 56 56 C57 42 53 27 44 24 Z" fill="${c}" />
    <path d="M38 24 L42 12 L50 24 Z" fill="${c}" />
    <path d="M44 24 C53 27 57 42 56 56 C55 66 47 74 36 74" fill="none" stroke="${d}" stroke-width="2.2" />
    <path d="M62 16 C70 26 72 38 66 50 M74 24 C84 36 84 52 76 64 M84 36 C92 46 90 60 82 70 M58 78 C68 82 76 80 82 74" fill="none" stroke="${d}" stroke-width="1.8" stroke-linecap="round" />
    <path d="M30 34 L38 37" stroke="${d}" stroke-width="2" stroke-linecap="round" /><ellipse cx="33" cy="40" rx="2.6" ry="1.7" fill="${d}" />
    <ellipse cx="7.5" cy="47" rx="2.4" ry="2" fill="${d}" />
    <path d="M9 55 Q16 60 24 57 M17 56 L17 62" fill="none" stroke="${d}" stroke-width="1.7" stroke-linecap="round" />
    <circle cx="18" cy="49" r="0.9" fill="${d}" /><circle cx="22" cy="51" r="0.9" fill="${d}" /><circle cx="20" cy="46" r="0.9" fill="${d}" />`,

  // A maiden in profile, hair flowing down behind her.
  Virgo: (c, d) => `
    <path d="M58 8 C74 6 86 18 86 34 C86 48 80 56 84 68 C88 80 80 92 66 94 C70 86 70 78 64 72 C60 68 56 66 56 60 L56 56 C52 56 49 54 49 50 L49 46 L45 44 L49 39 C47 37 47 34 49 32 L45 29 C47 22 50 10 58 8 Z" fill="${c}" />
    <path d="M60 12 C72 12 80 22 80 34 C80 46 74 52 76 62 C78 72 74 82 66 88" fill="none" stroke="${d}" stroke-width="1.8" stroke-linecap="round" />
    <path d="M68 18 C74 26 74 36 70 46 M74 54 C70 62 72 72 70 80" fill="none" stroke="${d}" stroke-width="1.5" stroke-linecap="round" />
    <path d="M30 96 C34 82 46 74 60 74" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" />
    <path d="M22 96 C28 80 42 70 56 70" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" />
    <ellipse cx="54" cy="31" rx="1.8" ry="1.2" fill="${d}" />`,

  // A pair of scales.
  Libra: (c) => `
    <g fill="none" stroke="${c}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 24 Q12 30 18 30 L82 30 Q88 30 92 24" stroke-width="3.6" />
      <path d="M50 18 L50 30" stroke-width="3.6" />
      <path d="M18 30 L8 66 M18 30 L28 66 M82 30 L72 66 M82 30 L92 66" stroke-width="1.6" />
    </g>
    <path d="M46 18 L50 10 L54 18 Z" fill="${c}" /><circle cx="50" cy="30" r="3.6" fill="${c}" />
    <path d="M4 66 L32 66 C30 76 24 80 18 80 C12 80 6 76 4 66 Z" fill="${c}" />
    <path d="M68 66 L96 66 C94 76 88 80 82 80 C76 80 70 76 68 66 Z" fill="${c}" />`,

  // A scorpion from above, tail curled up over its back.
  Scorpio: (c, d) => `
    <g fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round">
      <path d="M44 58 L30 52 L24 44" /><path d="M44 63 L28 62 L20 56" /><path d="M44 68 L30 72 L24 80" /><path d="M45 73 L34 80 L32 90" />
      <path d="M56 58 L70 52 L76 44" /><path d="M56 63 L72 62 L80 56" /><path d="M56 68 L70 72 L76 80" /><path d="M55 73 L66 80 L68 90" />
      <path d="M44 80 L32 90" /><path d="M56 80 L68 90" />
    </g>
    <ellipse cx="50" cy="66" rx="9" ry="15" fill="${c}" />
    <circle cx="50" cy="45" r="6" fill="${c}" /><circle cx="51" cy="35" r="5.4" fill="${c}" /><circle cx="54" cy="26" r="5" fill="${c}" />
    <circle cx="60" cy="18" r="4.6" fill="${c}" /><circle cx="68" cy="14" r="4.2" fill="${c}" />
    <path d="M72 12 Q80 12 78 22 L74 18 Z" fill="${c}" />
    <path d="M26 88 C22 92 22 98 28 98 C26 95 28 92 32 91 Z" fill="${c}" /><path d="M74 88 C78 92 78 98 72 98 C74 95 72 92 68 91 Z" fill="${c}" />
    <path d="M45 60 L55 60 M45 66 L55 66 M45 72 L55 72" stroke="${d}" stroke-width="1.4" />`,

  // A drawn bow with its arrow.
  Sagittarius: (c) => `
    <path d="M30 8 C8 24 8 76 30 92 C22 74 22 26 30 8 Z" fill="${c}" />
    <path d="M30 8 L30 92" fill="none" stroke="${c}" stroke-width="1.6" />
    <path d="M10 50 L84 50" fill="none" stroke="${c}" stroke-width="3.4" stroke-linecap="round" />
    <path d="M96 50 L80 42 L84 50 L80 58 Z" fill="${c}" />
    <path d="M10 50 L4 42 L14 42 L20 50 L14 58 L4 58 Z" fill="${c}" />`,

  // A goat's head, face-on, long horns sweeping back, and a beard.
  Capricorn: (c, d) => `
    <path d="M41 34 C35 20 22 11 7 12 C20 17 28 26 34 39 Z" fill="${c}" />
    <path d="M59 34 C65 20 78 11 93 12 C80 17 72 26 66 39 Z" fill="${c}" />
    <path d="M36 38 L18 34 L34 46 Z" fill="${c}" /><path d="M64 38 L82 34 L66 46 Z" fill="${c}" />
    <path d="M37 32 L63 32 C66 46 61 60 57 72 L43 72 C39 60 34 46 37 32 Z" fill="${c}" />
    <path d="M43 70 L47 94 L50 84 L53 94 L57 70 Z" fill="${c}" />
    <ellipse cx="44" cy="46" rx="2.6" ry="1.8" fill="${d}" /><ellipse cx="56" cy="46" rx="2.6" ry="1.8" fill="${d}" />
    <path d="M47 66 L50 68 L53 66" fill="none" stroke="${d}" stroke-width="1.5" stroke-linecap="round" />
    <path d="M18 14 C24 16 28 20 32 26 M82 14 C76 16 72 20 68 26" fill="none" stroke="${d}" stroke-width="1.5" />`,

  // A water jar, tipped, pouring out streams.
  Aquarius: (c, d) => `
    <g transform="rotate(-28 62 40)">
      <path d="M46 20 L78 20 L76 26 C88 32 90 50 84 62 C80 70 70 74 62 74 C54 74 44 70 40 62 C34 50 36 32 48 26 Z" fill="${c}" />
      <path d="M84 34 C96 34 98 50 86 54" fill="none" stroke="${c}" stroke-width="4" />
      <path d="M48 26 L76 26" stroke="${d}" stroke-width="1.6" />
    </g>
    <path d="M38 22 C26 30 22 46 24 62 C26 76 20 88 8 94 L22 94 C32 86 36 74 34 60 C33 48 36 36 44 28 Z" fill="${c}" />
    <path d="M44 30 C38 42 40 56 44 68 C48 80 46 90 40 96 L52 96 C56 88 56 78 52 66 C48 54 48 42 52 34 Z" fill="${c}" />`,

  // Two fish swimming in opposite directions, one above the other.
  Pisces: (c, d) => {
    const fish = `
      <path d="M22 32 C32 14 62 12 82 28 C64 42 38 46 22 32 Z" fill="${c}" />
      <path d="M24 32 L6 20 L12 32 L6 44 Z" fill="${c}" />
      <path d="M44 18 C50 10 60 10 64 16 Z" fill="${c}" /><path d="M46 40 C52 46 58 46 62 41 Z" fill="${c}" />
      <circle cx="71" cy="27" r="2.6" fill="${d}" />
      <path d="M62 19 C58 25 58 31 62 37" fill="none" stroke="${d}" stroke-width="1.6" stroke-linecap="round" />
      <path d="M36 26 L40 30 M42 24 L46 28 M48 23 L52 27" fill="none" stroke="${d}" stroke-width="1.3" stroke-linecap="round" />`;
    return `<g>${fish}</g><g transform="rotate(180 50 50)">${fish}</g>
      <path d="M84 30 C96 44 96 58 84 70 M16 70 C4 56 4 44 16 30" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity="0.7" />`;
  },
};

/** Cream badge colour the icons sit on, so every sign reads on a dark background. */
export const ZODIAC_BADGE = "#f6f1e4";

export function isZodiacSign(value: string): value is ZodiacSign {
  return (ZODIAC_SIGNS as string[]).includes(value);
}

/** The sign's drawing as SVG markup for a 100x100 box (no <svg> wrapper). */
export function zodiacIconMarkup(sign: ZodiacSign, detailColor = ZODIAC_BADGE): string {
  return DRAWINGS[sign](ZODIAC_COLORS[sign], detailColor);
}

/** The sign as a standalone, transparent-background SVG document. */
export function zodiacIconSvg(sign: ZodiacSign, detailColor = "#ffffff"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${zodiacIconMarkup(sign, detailColor)}</svg>`;
}

/**
 * The sign on a round cream badge -- for dark backgrounds (the form and
 * the wallpaper), where the darker signs' colours would otherwise vanish.
 */
export function zodiacBadgeSvg(sign: ZodiacSign): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><circle cx="60" cy="60" r="58" fill="${ZODIAC_BADGE}" /><g transform="translate(10 10)">${zodiacIconMarkup(sign)}</g></svg>`;
}
