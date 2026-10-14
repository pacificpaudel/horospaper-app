import { StructuredAstrologyData } from "@/lib/astrology";
import { buildPlanetDiagramsMarkup, buildPlanetNamesMarkup, diagramBoxes } from "./planetDiagram";
import { buildLuckMeterMarkup } from "./luckMeterOverlay";
import { buildDateHeader, shapeNepaliWeekday } from "./dateHeaderOverlay";
import { buildGaugeMarkup, buildGraphBackdropMarkup, SchumannView } from "./schumannOverlay";
import { buildGalaxyMarkup } from "./galaxyOverlay";
import { layoutWallpaper } from "./wallpaperLayout";
import type { LuckChartBox } from "@/types/models";
import { isZodiacSign, ZODIAC_COLORS, zodiacIconMarkup, ZodiacSign } from "./zodiacIcons";
import { buildCenteredVectorTextMarkup, TextStyle } from "./vectorFont";
import type { KundliData } from "@/lib/astrologyApi";
import { DailyReading } from "@/lib/dailyReading";

/** A hex colour mixed `amount` (0-1) of the way to white. */
function lighten(hex: string, amount: number): string {
  const channel = (k: number) => Math.round(parseInt(hex.slice(1 + k * 2, 3 + k * 2), 16) * (1 - amount) + 255 * amount);
  return `#${[0, 1, 2].map((k) => channel(k).toString(16).padStart(2, "0")).join("")}`;
}

/** The tags a reading shows: its 4 (one per luck source), or the older mood + theme pair. */
export function readingTags(reading: DailyReading): string[] {
  return reading.tags?.length ? reading.tags.map((t) => t.tag) : [reading.intent.mood, reading.intent.theme];
}

export interface TargetCanvas {
  width: number;
  height: number;
}

/**
 * Every overlay drawn on a `width`x`height` wallpaper, as SVG markup (no
 * <svg> wrapper): galaxy, the 4 corner planet diagrams and their names,
 * the date header (with the live Schumann graph as its backdrop) and its tags,
 * the Schumann gauge, the
 * and the luck meter. (The Luck Chart itself is opened from the page's
 * "Luck Chart" button, full screen -- not drawn on the wallpaper.) Shared by
 * the photo composite below and the local SVG artwork (mockImage.ts), so
 * the two can never lay things out differently.
 */
export async function buildOverlayLayers(params: OverlayParams): Promise<string> {
  return (await buildOverlay(params)).markup;
}


type OverlayParams = Parameters<typeof buildOverlay>[0];

/** buildOverlayLayers' markup, plus where the Luck Chart landed (null when there's none). */
export async function buildOverlay(params: {
  width: number;
  height: number;
  astrology: StructuredAstrologyData;
  /** The day's tags (see dailyReading.ts), shown under the date. */
  tags?: string[];
  /** The person's rashi as a western sign name ("Scorpio"), drawn as a badge under the tags. */
  zodiacSign?: string;
  luckScore: number;
  kundli?: KundliData | null;
  panchang: DailyReading["panchang"];
  flush?: boolean;
  schumann?: SchumannView | null;
}): Promise<{ markup: string; luckChartBox: LuckChartBox | null }> {
  const { width, height, astrology, tags, schumann } = params;
  const flush = Boolean(params.flush);
  const date = astrology.generationDate;
  const gap = Math.round(Math.min(width, height) * 0.015);
  const score = schumann?.snapshot.score ?? null;
  const graph = schumann?.snapshot.graph ?? null;

  // The live Schumann graph is the weekday/date panel's own backdrop -- no
  // panel or title of its own -- so the wallpaper keeps its open space.
  const nepaliWeekday = await shapeNepaliWeekday(date);
  const header = buildDateHeader(width, height, date, tags, 0, nepaliWeekday, graph && schumann ? (box, rx) => buildGraphBackdropMarkup(box, graph, rx, schumann.now) : undefined);
  const dateBox = header.dateBox;
  const topBoxes = diagramBoxes(width, height, flush).filter((b) => b.spec.corner.startsWith("top"));

  // The calmness gauge and the person's zodiac sign sit either side of the
  // weekday/date panel -- the gauge between it and the Sun diagram, the sign
  // between it and the Moon diagram -- when those gaps are wide enough (frame
  // and desktop). Otherwise (the inset mobile canvas) the sign goes under
  // the tags and the gauge to the middle of the image (wallpaperLayout.ts).
  const minDim = Math.min(width, height);
  const sun = topBoxes.find((b) => b.spec.corner === "top-left")!;
  const moon = topBoxes.find((b) => b.spec.corner === "top-right")!;
  const leftGap = { x0: sun.x + sun.size + gap, x1: dateBox.x - gap };
  const rightGap = { x0: dateBox.x + dateBox.w + gap, x1: moon.x - gap };
  const room = Math.min(leftGap.x1 - leftGap.x0, rightGap.x1 - rightGap.x0, dateBox.h, minDim * 0.17);
  const besideDate = room >= minDim * 0.08;
  // The gauge and the sign are kept modest, well inside the room they have.
  const sideD = Math.min(room * 0.72, minDim * 0.11);
  const rowCy = dateBox.y + dateBox.h / 2;

  const nameSize = minDim * 0.016;
  const nameStyle: TextStyle = { color: "#f7c56a", strokeWidth: 0.11, tracking: 0.3 };
  // The sign's own drawing, with no badge behind it: lightened from its own
  // (often dark) colour, with a soft dark halo, so it reads on any photo.
  const zodiacBadge = (cx: number, top: number, d: number, sign: ZodiacSign) =>
    `<svg x="${(cx - d / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${d.toFixed(1)}" height="${d.toFixed(1)}" viewBox="-5 -5 110 110" overflow="visible"><defs><filter id="zodiac-halo" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="3" /><feComponentTransfer><feFuncA type="linear" slope="0.8" /></feComponentTransfer><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs><g filter="url(#zodiac-halo)">${zodiacIconMarkup(sign, "#0b1220", lighten(ZODIAC_COLORS[sign], 0.5))}</g></svg>` +
    buildCenteredVectorTextMarkup(sign.toUpperCase(), cx, top + d + nameSize * 0.7, nameSize, nameStyle);

  let headerBottom = header.bottom;
  let zodiacMarkup = "";
  let sideGauge = "";
  const sign = params.zodiacSign && isZodiacSign(params.zodiacSign) ? params.zodiacSign : null;
  if (besideDate) {
    if (score !== null) sideGauge = buildGaugeMarkup((leftGap.x0 + leftGap.x1) / 2, rowCy, sideD, score);
    if (sign) {
      // Badge plus its name below, together centered on the date panel.
      const d = Math.min(sideD, dateBox.h - nameSize * 1.7);
      zodiacMarkup = zodiacBadge((rightGap.x0 + rightGap.x1) / 2, rowCy - (d + nameSize * 1.7) / 2, d, sign);
    }
  } else if (sign) {
    const d = minDim * 0.065;
    const top = header.bottom + gap;
    zodiacMarkup = zodiacBadge(width / 2, top, d, sign);
    headerBottom = top + d + nameSize * 1.7;
  }

  const [layout, planetNames] = await Promise.all([
    layoutWallpaper({
      width,
      height,
      headerBottom,
      headerRight: header.right,
      flush,
      // The Luck Chart opens full screen from the page instead.
      hasKundli: false,
      panchang: params.panchang,
      // Already drawn beside the date panel when there's room there.
      score: besideDate ? null : score,
    }),
    buildPlanetNamesMarkup(width, height, flush),
  ]);
  const markup = [
    buildGalaxyMarkup(width, height, date),
    buildPlanetDiagramsMarkup(astrology, width, height, flush),
    planetNames,
    header.markup,
    zodiacMarkup,
    sideGauge || (layout.gauge && score != null ? buildGaugeMarkup(layout.gauge.cx, layout.gauge.cy, layout.gauge.d, score) : ""),
    buildLuckMeterMarkup(width, height, params.luckScore),
  ].join("");
  return { markup, luckChartBox: null };
}

/**
 * Composites every wallpaper overlay (see buildOverlayLayers) onto a
 * raster image (JPEG/PNG/WEBP), so the downloaded file is a single
 * complete wallpaper rather than needing the on-page overlays to make
 * sense of it. With no `target`, the image's own dimensions are used
 * untouched (the desktop/default path). With a `target`, the source is
 * first smart-cropped to fill that canvas exactly -- used to produce a
 * phone-wallpaper-shaped variant from whatever aspect ratio the source
 * photo happens to be.
 */
export async function withWallpaperOverlay(
  image: Buffer,
  astrology: StructuredAstrologyData,
  reading: DailyReading,
  target?: TargetCanvas,
  flushPlanets = false,
  schumann?: SchumannView | null
): Promise<{ buffer: Buffer; luckChartBox: LuckChartBox | null }> {
  const sharp = (await import("sharp")).default;
  let base = sharp(image);
  let width: number;
  let height: number;

  if (target) {
    base = base.resize(target.width, target.height, { fit: "cover", position: sharp.strategy.attention });
    width = target.width;
    height = target.height;
  } else {
    const metadata = await base.metadata();
    width = metadata.width ?? 1080;
    height = metadata.height ?? 1350;
  }

  const { markup: layers, luckChartBox } = await buildOverlay({
    width,
    height,
    astrology,
    tags: readingTags(reading),
    zodiacSign: reading.rashi?.sign,
    luckScore: reading.luckScore,
    kundli: reading.kundli,
    panchang: reading.panchang,
    flush: flushPlanets,
    schumann,
  });
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${layers}</svg>`;
  return { buffer: await base.composite([{ input: Buffer.from(overlay), top: 0, left: 0 }]).toBuffer(), luckChartBox };
}
