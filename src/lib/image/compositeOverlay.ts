import { StructuredAstrologyData } from "@/lib/astrology";
import { buildPlanetDiagramsMarkup, buildPlanetNamesMarkup } from "./planetDiagram";
import { buildLuckMeterMarkup } from "./luckMeterOverlay";
import { buildDateHeaderMarkup, dateHeaderBottom } from "./dateHeaderOverlay";
import { buildGaugeMarkup, buildGraphMarkup, SchumannView } from "./schumannOverlay";
import { buildGalaxyMarkup } from "./galaxyOverlay";
import { buildGocharMarkup } from "./kundliOverlay";
import { layoutWallpaper } from "./wallpaperLayout";
import type { DailyIntent } from "./dailyIntent";
import type { KundliData } from "@/lib/astrologyApi";
import { DailyReading } from "@/lib/dailyReading";

export interface TargetCanvas {
  width: number;
  height: number;
}

/**
 * Every overlay drawn on a `width`x`height` wallpaper, as SVG markup (no
 * <svg> wrapper): galaxy, the 4 corner planet diagrams and their names,
 * the date header with its 2 tags, the Schumann gauge + live graph, the
 * gochar block (with the day's Panchang), and the luck meter. Shared by
 * the photo composite below and the local SVG artwork (mockImage.ts), so
 * the two can never lay things out differently.
 */
export async function buildOverlayLayers(params: {
  width: number;
  height: number;
  astrology: StructuredAstrologyData;
  intent?: DailyIntent;
  luckScore: number;
  kundli?: KundliData | null;
  panchang: DailyReading["panchang"];
  flush?: boolean;
  schumann?: SchumannView | null;
}): Promise<string> {
  const { width, height, astrology, intent, kundli, schumann } = params;
  const flush = Boolean(params.flush);
  const date = astrology.generationDate;
  const [layout, planetNames] = await Promise.all([
    layoutWallpaper({
      width,
      height,
      headerBottom: dateHeaderBottom(width, height, date, intent),
      flush,
      hasKundli: Boolean(kundli),
      panchang: params.panchang,
      snapshot: schumann?.snapshot,
    }),
    buildPlanetNamesMarkup(width, height, flush),
  ]);
  const score = schumann?.snapshot.score;
  const graph = schumann?.snapshot.graph;
  return [
    buildGalaxyMarkup(width, height, date),
    buildPlanetDiagramsMarkup(astrology, width, height, flush),
    planetNames,
    buildDateHeaderMarkup(width, height, date, intent),
    layout.graph && graph && schumann ? buildGraphMarkup(layout.graph, graph, layout.labelSize, schumann) : "",
    layout.gauge && score != null ? buildGaugeMarkup(layout.gauge.cx, layout.gauge.cy, layout.gauge.d, score) : "",
    layout.gochar && kundli ? buildGocharMarkup(layout.gochar, kundli, date) : "",
    buildLuckMeterMarkup(width, height, params.luckScore),
  ].join("");
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
): Promise<Buffer> {
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

  const layers = await buildOverlayLayers({
    width,
    height,
    astrology,
    intent: reading.intent,
    luckScore: reading.luckScore,
    kundli: reading.kundli,
    panchang: reading.panchang,
    flush: flushPlanets,
    schumann,
  });
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${layers}</svg>`;
  return base.composite([{ input: Buffer.from(overlay), top: 0, left: 0 }]).toBuffer();
}
