import { StructuredAstrologyData } from "@/lib/astrology";
import { buildPlanetDiagramsMarkup, buildPlanetNamesMarkup, diagramBoxes, diagramZone } from "./planetDiagram";
import { buildLuckMeterMarkup } from "./luckMeterOverlay";
import { buildDateHeader } from "./dateHeaderOverlay";
import { Box, buildGaugeMarkup, buildGraphMarkup, graphHeightFor, graphLabelSize, SchumannView } from "./schumannOverlay";
import { buildGalaxyMarkup } from "./galaxyOverlay";
import { buildGocharMarkup } from "./gocharOverlay";
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
 * the date header with the Schumann graph under it and then its 2 tags,
 * the Schumann gauge, the
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
  const gap = Math.round(Math.min(width, height) * 0.015);
  const score = schumann?.snapshot.score ?? null;
  const graph = schumann?.snapshot.graph ?? null;

  // The Schumann graph sits right under the weekday/date panel, exactly as
  // wide as it -- narrowed only where it would run into a top corner
  // diagram (or its name) -- with the 2 tags moving down below it.
  let graphBox: Box | null = null;
  if (graph) {
    const dateBox = buildDateHeader(width, height, date).dateBox;
    const y = dateBox.y + dateBox.h + gap;
    let x0 = dateBox.x;
    let x1 = dateBox.x + dateBox.w;
    for (const box of diagramBoxes(width, height, flush).filter((b) => b.spec.corner.startsWith("top"))) {
      if (diagramZone(box).bottom <= y) continue;
      if (box.spec.corner === "top-left") x0 = Math.max(x0, box.x + box.size + gap);
      else x1 = Math.min(x1, box.x - gap);
    }
    graphBox = { x: x0, y, w: x1 - x0, h: graphHeightFor(x1 - x0, graph) };
  }
  const header = buildDateHeader(width, height, date, intent, graphBox ? graphBox.h + gap * 2 : 0);

  const [layout, planetNames] = await Promise.all([
    layoutWallpaper({
      width,
      height,
      headerBottom: header.bottom,
      headerRight: Math.max(header.right, graphBox ? graphBox.x + graphBox.w : 0),
      flush,
      hasKundli: Boolean(kundli),
      panchang: params.panchang,
      score,
    }),
    buildPlanetNamesMarkup(width, height, flush),
  ]);
  return [
    buildGalaxyMarkup(width, height, date),
    buildPlanetDiagramsMarkup(astrology, width, height, flush),
    planetNames,
    header.markup,
    graphBox && graph && schumann ? buildGraphMarkup(graphBox, graph, graphLabelSize(graphBox.w), schumann) : "",
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
