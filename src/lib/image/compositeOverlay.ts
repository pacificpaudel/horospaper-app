import { StructuredAstrologyData } from "@/lib/astrology";
import { buildPlanetDiagramsMarkup, buildPlanetNamesMarkup, diagramBoxes, diagramZone } from "./planetDiagram";
import { buildLuckMeterMarkup } from "./luckMeterOverlay";
import { buildDateHeader, shapeNepaliWeekday } from "./dateHeaderOverlay";
import { Box, buildGaugeMarkup, buildGraphMarkup, graphHeightFor, graphLabelSize, SchumannView } from "./schumannOverlay";
import { buildGalaxyMarkup } from "./galaxyOverlay";
import { buildGocharMarkup } from "./gocharOverlay";
import { GocharLayout, layoutWallpaper } from "./wallpaperLayout";
import type { LuckChartBox } from "@/types/models";
import { isZodiacSign, ZODIAC_BADGE, zodiacIconMarkup, ZodiacSign } from "./zodiacIcons";
import { buildCenteredVectorTextMarkup, TextStyle } from "./vectorFont";
import type { KundliData } from "@/lib/astrologyApi";
import { DailyReading } from "@/lib/dailyReading";

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
 * the date header with the Schumann graph under it and then its 2 tags,
 * the Schumann gauge, the
 * gochar block (with the day's Panchang), and the luck meter. Shared by
 * the photo composite below and the local SVG artwork (mockImage.ts), so
 * the two can never lay things out differently.
 */
export async function buildOverlayLayers(params: OverlayParams): Promise<string> {
  return (await buildOverlay(params)).markup;
}

/** The gochar block's bounds -- caption, chart and Analysis panel -- for a click target. */
function luckChartBoxOf(gochar: GocharLayout, width: number, height: number): LuckChartBox {
  const right = Math.max(gochar.x0 + gochar.size, gochar.caption.x + gochar.caption.w, gochar.analysis ? gochar.analysis.x + gochar.analysis.w : 0);
  const left = Math.min(gochar.x0, gochar.caption.x);
  const top = Math.min(gochar.caption.y, gochar.analysis?.y ?? Infinity);
  const bottom = Math.max(gochar.y0 + gochar.size, gochar.analysis ? gochar.analysis.y + gochar.analysis.h : 0);
  return { x: Math.round(left), y: Math.round(top), w: Math.round(right - left), h: Math.round(bottom - top), canvasW: width, canvasH: height };
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
  const { width, height, astrology, tags, kundli, schumann } = params;
  const flush = Boolean(params.flush);
  const date = astrology.generationDate;
  const gap = Math.round(Math.min(width, height) * 0.015);
  const score = schumann?.snapshot.score ?? null;
  const graph = schumann?.snapshot.graph ?? null;

  // The Schumann graph sits right under the weekday/date panel, exactly as
  // wide as it -- narrowed only where it would run into a top corner
  // diagram (or its name) -- with the 2 tags moving down below it.
  const nepaliWeekday = await shapeNepaliWeekday(date);
  const dateBox = buildDateHeader(width, height, date, undefined, 0, nepaliWeekday).dateBox;
  const topBoxes = diagramBoxes(width, height, flush).filter((b) => b.spec.corner.startsWith("top"));
  let graphBox: Box | null = null;
  if (graph) {
    const y = dateBox.y + dateBox.h + gap;
    let x0 = dateBox.x;
    let x1 = dateBox.x + dateBox.w;
    for (const box of topBoxes) {
      if (diagramZone(box).bottom <= y) continue;
      if (box.spec.corner === "top-left") x0 = Math.max(x0, box.x + box.size + gap);
      else x1 = Math.min(x1, box.x - gap);
    }
    graphBox = { x: x0, y, w: x1 - x0, h: graphHeightFor(x1 - x0, graph) };
  }
  const header = buildDateHeader(width, height, date, tags, graphBox ? graphBox.h + gap * 2 : 0, nepaliWeekday);

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
  const sideD = Math.min(leftGap.x1 - leftGap.x0, rightGap.x1 - rightGap.x0, dateBox.h, minDim * 0.17);
  const besideDate = sideD >= minDim * 0.08;
  const rowCy = dateBox.y + dateBox.h / 2;

  const nameSize = minDim * 0.016;
  const nameStyle: TextStyle = { color: "#f7c56a", strokeWidth: 0.11, tracking: 0.3 };
  const zodiacBadge = (cx: number, top: number, d: number, sign: ZodiacSign) =>
    `<svg x="${(cx - d / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${d.toFixed(1)}" height="${d.toFixed(1)}" viewBox="0 0 120 120"><circle cx="60" cy="60" r="58" fill="${ZODIAC_BADGE}" fill-opacity="0.92" /><g transform="translate(10 10)">${zodiacIconMarkup(sign)}</g></svg>` +
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
    const d = minDim * 0.085;
    const top = header.bottom + gap;
    zodiacMarkup = zodiacBadge(width / 2, top, d, sign);
    headerBottom = top + d + nameSize * 1.7;
  }

  const [layout, planetNames] = await Promise.all([
    layoutWallpaper({
      width,
      height,
      headerBottom,
      headerRight: Math.max(header.right, graphBox ? graphBox.x + graphBox.w : 0),
      flush,
      hasKundli: Boolean(kundli),
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
    graphBox && graph && schumann ? buildGraphMarkup(graphBox, graph, graphLabelSize(graphBox.w), schumann) : "",
    sideGauge || (layout.gauge && score != null ? buildGaugeMarkup(layout.gauge.cx, layout.gauge.cy, layout.gauge.d, score) : ""),
    layout.gochar && kundli ? buildGocharMarkup(layout.gochar, kundli, date) : "",
    buildLuckMeterMarkup(width, height, params.luckScore),
  ].join("");
  return { markup, luckChartBox: layout.gochar && kundli ? luckChartBoxOf(layout.gochar, width, height) : null };
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
