import { ImageStyle } from "@/types/enums";
import { StructuredAstrologyData } from "@/lib/astrology";
import { buildPlanetDiagramsMarkup } from "./planetDiagram";

const WIDTH = 1080;
const HEIGHT = 1350; // 4:5

const PALETTES: Record<ImageStyle, [string, string, string]> = {
  COSMIC: ["#1b1035", "#3a1c71", "#7b2ff7"],
  MINIMAL: ["#0f0f14", "#1c1c24", "#e8e6f0"],
  MYSTICAL: ["#160b28", "#4b2c6f", "#c9a7ff"],
  WATERCOLOR: ["#1a2238", "#4a5d8a", "#f2c6d9"],
  RENAISSANCE: ["#1c1408", "#5c3a1e", "#e6b95c"],
  MODERN_CELESTIAL: ["#0b1220", "#1e3a5f", "#5ce1e6"],
  DARK_SPACE: ["#000005", "#0a0a14", "#3d3d5c"],
  DREAMY: ["#241b3a", "#7a5c9e", "#ffd6e8"],
  ABSTRACT: ["#1a0f2e", "#c9184a", "#ffb703"],
  MIXED_MEDIA: ["#17243a", "#416c70", "#f2a65a"],
};

// Small deterministic PRNG (mulberry32) so the same seed always produces
// the same artwork -- useful for regeneration consistency and testing.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Generates a procedural SVG "cosmic portrait" as a placeholder when no
 * external image-generation API is configured. Deterministic per seed so
 * regenerating the same day's horoscope produces a stable image.
 */
export function generateMockHoroscopeImageSvg(opts: {
  seed: string;
  style: ImageStyle;
  luckScore: number;
  astrology?: StructuredAstrologyData;
  luckyTheme?: string;
  emotionalTheme?: string;
  moonIllumination?: number;
  target?: { width: number; height: number };
}): string {
  const rand = mulberry32(hashSeed(opts.seed));
  const [, bg2, accent] = PALETTES[opts.style];
  const astrology = opts.astrology;
  const moonIllumination = astrology?.today.moonIllumination ?? opts.moonIllumination ?? 0.5;
  const harmonious = astrology?.transits.filter((transit) => transit.nature === "harmonious").length ?? 0;
  const challenging = astrology?.transits.filter((transit) => transit.nature === "challenging").length ?? 0;
  const dayPulse = Math.max(0, Math.min(1, 0.5 + (harmonious - challenging) * 0.08 + moonIllumination * 0.22));
  const mood = opts.luckScore >= 70 ? "open" : opts.luckScore >= 45 ? "reflective" : "tender";
  const faceTilt = mood === "open" ? -5 : mood === "tender" ? 5 : 0;
  const mouthPath = mood === "open" ? "M770 835c28 18 57 18 84 0" : mood === "tender" ? "M770 840c27-10 54-10 82 0" : "M770 837c25 3 52 3 79 0";

  const flecks = Array.from({ length: 120 })
    .map(() => {
      const x = Math.round(rand() * WIDTH);
      const y = Math.round(rand() * HEIGHT);
      const size = Math.round(rand() * 12 + 3);
      const rotation = Math.round(rand() * 180);
      const color = rand() > 0.5 ? accent : "#f8edcf";
      return `<rect x="${x}" y="${y}" width="${size}" height="${Math.max(2, Math.round(size / 3))}" rx="2" fill="${color}" opacity="${(rand() * 0.24 + 0.08).toFixed(2)}" transform="rotate(${rotation} ${x} ${y})" />`;
    })
    .join("");

  const moonR = 150;
  const moonCx = WIDTH / 2;
  const moonCy = HEIGHT * 0.42;
  const orbitRings = Array.from({ length: 4 })
    .map((_, i) => {
      const r = 260 + i * 70;
      return `<ellipse cx="${moonCx}" cy="${moonCy}" rx="${r}" ry="${Math.round(r * 0.45)}" fill="none" stroke="#20314d" stroke-opacity="${0.12 - i * 0.02}" stroke-width="3" transform="rotate(${i * 14 - 20} ${moonCx} ${moonCy})" />`;
    })
    .join("");

  const paperScraps = Array.from({ length: 8 })
    .map((_, index) => {
      const x = 75 + Math.round(rand() * 850);
      const y = 170 + Math.round(rand() * 820);
      const width = 80 + Math.round(rand() * 170);
      const height = 55 + Math.round(rand() * 120);
      const rotate = Math.round(rand() * 36 - 18);
      const fill = index % 2 === 0 ? "#efe2bf" : "#d9c99c";
      return `<path d="M${x} ${y}l${width} ${Math.round(height * 0.08)} ${width - 12} ${height} ${Math.round(width * 0.12)} ${height - 8}Z" fill="${fill}" opacity="0.72" transform="rotate(${rotate} ${x + width / 2} ${y + height / 2})" />`;
    })
    .join("");

  const paintStrokes = Array.from({ length: 12 })
    .map((_, index) => {
      const x = 90 + Math.round(rand() * 820);
      const y = 160 + Math.round(rand() * 1000);
      const length = 80 + Math.round(rand() * 250);
      const width = 6 + Math.round(rand() * 18);
      const color = index % 3 === 0 ? accent : index % 3 === 1 ? bg2 : "#d66a4e";
      return `<path d="M${x} ${y}c${Math.round(length * 0.3)} ${-width * 2},${Math.round(length * 0.7)} ${width * 2},${x + length} ${Math.round(y + rand() * 12 - 6)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="${(0.16 + dayPulse * 0.2).toFixed(2)}" />`;
    })
    .join("");

  const botanical = Array.from({ length: 7 })
    .map((_, index) => {
      const x = 110 + index * 145 + Math.round(rand() * 40);
      const y = 1110 + Math.round(rand() * 90);
      return `<path d="M${x} ${y}c${Math.round(rand() * 30 - 15)} -90,${Math.round(rand() * 35 - 10)} -150,${Math.round(rand() * 30 - 15)} -225M${x - 2} ${y - 86}c-42-25-51-50-44-70 35 9 51 32 44 70M${x} ${y - 130}c34-30 54-53 48-76-39 12-54 38-48 76" fill="none" stroke="#315d58" stroke-width="7" stroke-linecap="round" opacity="0.78" />`;
    })
    .join("");

  const moon = Math.max(0.04, Math.min(0.96, moonIllumination));
  const terminatorX = moonR - moon * 2 * moonR;
  const targetWidth = opts.target?.width ?? WIDTH;
  const targetHeight = opts.target?.height ?? HEIGHT;
  const planetDiagrams = astrology ? buildPlanetDiagramsMarkup(astrology, targetWidth, targetHeight) : "";

  const artwork = `<defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f2e6c8" />
      <stop offset="48%" stop-color="#d8d2ad" />
      <stop offset="100%" stop-color="#b8c7b1" />
    </linearGradient>
    <radialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f7dc8c" stop-opacity="${(0.4 + dayPulse * 0.28).toFixed(2)}" />
      <stop offset="100%" stop-color="#d66a4e" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="orb" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#e9f4e5" />
      <stop offset="0.55" stop-color="#8db9ad" />
      <stop offset="1" stop-color="#3e7180" />
    </linearGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.78" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncA type="table" tableValues="0 0.14" /></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply" /></filter>
    <clipPath id="orbClip">
      <circle cx="${moonCx}" cy="${moonCy}" r="${moonR}" />
    </clipPath>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#paper)" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#6c8575" opacity="0.08" filter="url(#grain)" />
  <path d="M0 190c260-90 420 90 650-10s410-60 430 35v165H0Z" fill="${bg2}" opacity="0.25" />
  <path d="M0 750c230-150 390 85 640-20s420-80 440 130v250H0Z" fill="${accent}" opacity="0.16" />
  ${paperScraps}
  ${paintStrokes}
  ${flecks}
  ${orbitRings}
  <circle cx="${moonCx}" cy="${moonCy}" r="${moonR + 95}" fill="url(#orbGlow)" />

  <g clip-path="url(#orbClip)">
    <rect x="${moonCx - moonR}" y="${moonCy - moonR}" width="${moonR * 2}" height="${moonR * 2}" fill="url(#orb)" />
    <rect x="${moonCx - moonR}" y="${moonCy - moonR}" width="${moonR + terminatorX}" height="${moonR * 2}" fill="#20314d" opacity="${(0.42 - dayPulse * 0.18).toFixed(2)}" />
    <path d="M${moonCx - moonR} ${moonCy + 75}c80-120 130 40 250-90v190h-250Z" fill="#f1bd70" opacity="0.5" />
    <path d="M${moonCx - 100} ${moonCy + 110}c50-80 110 20 205-80" fill="none" stroke="#f8edcf" stroke-width="16" opacity="0.4" />
  </g>
  <circle cx="${moonCx}" cy="${moonCy}" r="${moonR}" fill="none" stroke="#f8edcf" stroke-opacity="0.72" stroke-width="8" />
  <circle cx="${moonCx - 65}" cy="${moonCy - 72}" r="34" fill="#fff7df" opacity="0.45" />
  <g transform="rotate(${faceTilt} 790 790)" opacity="0.9">
    <path d="M715 1005c18-150 27-245 80-278 57-35 128 3 137 76 5 43-10 95-41 122-31 26-75 29-108 17l-26 72Z" fill="#bd8067" opacity="0.92" />
    <path d="M729 763c9-76 54-113 112-111 58 2 91 42 93 87-45-24-73-48-102-65-13 44-44 75-103 89Z" fill="#263448" />
    <path d="M770 796c18-10 37-10 53 0" fill="none" stroke="#30243a" stroke-width="8" stroke-linecap="round" />
    <circle cx="797" cy="798" r="5" fill="#30243a" />
    <path d="${mouthPath}" fill="none" stroke="#713f45" stroke-width="6" stroke-linecap="round" />
    <path d="M717 1010c47-45 118-54 187 0l55 82H675Z" fill="#315d58" opacity="0.88" />
  </g>
  <g opacity="0.22" transform="translate(-250 0) scale(-1 1)">
    <path d="M715 1005c18-150 27-245 80-278 57-35 128 3 137 76 5 43-10 95-41 122-31 26-75 29-108 17l-26 72Z" fill="#bd8067" />
    <path d="M729 763c9-76 54-113 112-111 58 2 91 42 93 87-45-24-73-48-102-65-13 44-44 75-103 89Z" fill="#263448" />
  </g>
  ${botanical}
  <path d="M112 1215c190-48 345 45 500-5s300-60 410 12" fill="none" stroke="#20314d" stroke-width="5" stroke-dasharray="12 20" opacity="0.55" />`;

  if (targetWidth === WIDTH && targetHeight === HEIGHT) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${artwork}${planetDiagrams}</svg>`;
  }

  // A taller/narrower target (e.g. a phone wallpaper canvas) reuses the same
  // hand-tuned artwork, cover-cropped via a nested SVG viewport instead of
  // re-laying out every hardcoded coordinate above. Diagrams are then drawn
  // fresh in the real target coordinate space so they stay correctly inset.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${targetWidth}" height="${targetHeight}" viewBox="0 0 ${targetWidth} ${targetHeight}">
  <svg x="0" y="0" width="${targetWidth}" height="${targetHeight}" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="xMidYMid slice">${artwork}</svg>
  ${planetDiagrams}
</svg>`;
}
