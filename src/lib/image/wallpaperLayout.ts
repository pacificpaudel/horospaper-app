import type { DailyReading } from "@/lib/dailyReading";
import { shapeDevanagariText, ShapedText } from "./devanagariShaper";
import { luckMeterTop } from "./luckMeterOverlay";
import { diagramBoxes, diagramZone } from "./planetDiagram";
import { shapePanchangFacts, shapePanchangSummary } from "./panchangOverlay";
import type { Box } from "./schumannOverlay";

// Where the gauge and the gochar block go -- everything between the
// header block (date panel, the Schumann graph right under it, the 2 tags)
// and the luck meter: the Schumann calmness gauge, and the gochar block (a
// "भाग्य कुन्डली / LUCK CHART" caption with the day's Panchang facts on one line, the
// gochar chart, and the Panchang prediction as a strip below it). Laid out
// together so neither can overlap the other, the header or the corner
// diagrams.
//
// Portrait (mobile/frame): the gauge centered under the header, the
// gochar block on the luck meter, as large as fits without rising past the
// image's horizontal center. Landscape (desktop): the gauge at the center
// of the image and the gochar block in a column to its right, never left
// of the center line. Either way the chart grows past its reference size
// (KUNDLI_FRACTION) when there's room, up to KUNDLI_MAX_FRACTION. A
// landscape canvas too narrow for that column falls back to the portrait
// arrangement.

/** The kundli's reference size (text scales against it): 26% of the short side, +20%, then +10%. */
const KUNDLI_FRACTION = 0.343;
/**
 * The largest the kundli may grow to when there's room -- bigger houses keep
 * split halves, day counts and "last position" labels from crowding. The
 * block still never crosses the image's center line (see layoutWallpaper).
 */
const KUNDLI_MAX_FRACTION = 0.6;
/** Width kept for the Analysis panel beside a portrait chart (share of the short side). */
const ANALYSIS_MIN_FRACTION = 0.2;

/** Builds the block at up to `maxSize`, shrinking the chart until the whole block fits `maxHeight`. */
async function fitBlock(opts: Omit<Parameters<typeof gocharBlock>[0], "size">, maxSize: number, maxHeight: number): Promise<{ block: Block; size: number }> {
  let size = Math.round(maxSize);
  let block = await gocharBlock({ ...opts, size });
  // The chart (and its title row, 10% of it) is what gives way; the caption
  // and strip text don't shrink with it, so a couple of passes converge.
  for (let pass = 0; pass < 4 && block.height > maxHeight && size > opts.minDim * 0.15; pass++) {
    size = Math.max(opts.minDim * 0.15, size - (block.height - maxHeight) / 1.1);
    block = await gocharBlock({ ...opts, size });
  }
  return { block, size };
}
/** The calmness gauge's diameter, as a share of the canvas's short side. */
const GAUGE_FRACTION = 0.11;

export interface GocharLayout {
  /** The chart's square. */
  x0: number;
  y0: number;
  size: number;
  /** Caption backdrop above the chart: title row, then the Panchang facts row. */
  caption: Box;
  titleHeight: number;
  /** The good / neutral / bad colour legend's row, at the caption's bottom. */
  legendHeight: number;
  /** "भाग्य कुन्डली", shaped -- the Devanagari half of the caption's title. */
  titleText: ShapedText;
  facts: { text: ShapedText; size: number } | null;
  /** The "Analysis" panel just right of the chart (see gocharOverlay.ts), or null without room. */
  analysis: Box | null;
  /** The Panchang prediction below the chart, if there is one. */
  strip: { box: Box; lines: ShapedText[]; size: number; lineHeight: number; padY: number } | null;
}

export interface WallpaperLayout {
  gauge: { cx: number; cy: number; d: number } | null;
  gochar: GocharLayout | null;
}

interface Block {
  height: number;
  place(top: number): GocharLayout;
}

async function gocharBlock(opts: {
  cx: number;
  size: number;
  maxCaptionWidth: number;
  stripWidth: number;
  minDim: number;
  gap: number;
  facts: ShapedText | null;
  titleText: ShapedText;
  panchang: DailyReading["panchang"];
  /** Shrinks the Panchang facts and prediction text along with a narrowed chart (1 = full size). */
  textScale?: number;
}): Promise<Block> {
  const { cx, size, minDim, facts } = opts;
  const titleHeight = size * 0.1;
  const factsPad = minDim * 0.03;
  const textScale = opts.textScale ?? 1;
  const factsSize = facts ? Math.min(minDim * 0.022 * textScale, (opts.maxCaptionWidth - factsPad * 2) / facts.width) : 0;
  const legendHeight = titleHeight * 0.8;
  const captionH = titleHeight + (facts ? factsSize * 1.75 : 0) + legendHeight;
  const captionW = Math.min(opts.maxCaptionWidth, Math.max(size, facts ? facts.width * factsSize + factsPad * 2 : 0));

  const lineSize = minDim * 0.025 * textScale;
  const lineHeight = lineSize * 1.55;
  const padY = lineSize * 0.55;
  const padX = lineSize * 1.1;
  const lines = await shapePanchangSummary(opts.panchang, opts.stripWidth - padX * 2, lineSize);
  const stripH = lines.length ? padY * 2 + lines.length * lineHeight - (lineHeight - lineSize) : 0;
  const stripW = Math.min(opts.stripWidth, Math.max(size, Math.max(0, ...lines.map((line) => line.width * lineSize)) + padX * 2));
  const stripGap = opts.gap * 0.8;

  return {
    height: captionH + size + (lines.length ? stripGap + stripH : 0),
    place(top) {
      const y0 = top + captionH;
      return {
        x0: cx - size / 2,
        y0,
        size,
        caption: { x: cx - captionW / 2, y: top, w: captionW, h: captionH },
        analysis: null, // placed by layoutWallpaper, which knows the canvas
        titleHeight,
        legendHeight,
        titleText: opts.titleText,
        facts: facts ? { text: facts, size: factsSize } : null,
        strip: lines.length ? { box: { x: cx - stripW / 2, y: y0 + size + stripGap, w: stripW, h: stripH }, lines, size: lineSize, lineHeight, padY } : null,
      };
    },
  };
}

export async function layoutWallpaper(params: {
  width: number;
  height: number;
  /** Bottom and right edges of the header block (date panel, Schumann graph, tags). */
  headerBottom: number;
  headerRight: number;
  flush: boolean;
  hasKundli: boolean;
  panchang: DailyReading["panchang"];
  /** The Schumann calmness score, or null if unavailable. */
  score: number | null;
}): Promise<WallpaperLayout> {
  const { width, height, flush, score } = params;
  const minDim = Math.min(width, height);
  const gap = Math.round(minDim * 0.015);
  const luckTop = luckMeterTop(width, height);
  const boxes = diagramBoxes(width, height, flush);
  const topZoneBottom = Math.max(...boxes.filter((b) => b.spec.corner.startsWith("top")).map((b) => diagramZone(b).bottom));
  const facts = params.hasKundli ? await shapePanchangFacts(params.panchang) : null;
  const titleText = await shapeDevanagariText("भाग्य कुन्डली");
  const startY = params.headerBottom + gap;
  const regionBottom = luckTop - gap;

  // The Analysis panel: just right of the chart, from the top of its
  // caption, as tall as fits -- clear of the corner diagrams (and their
  // names) on that side.
  const withAnalysis = (gochar: GocharLayout): GocharLayout => {
    const x = Math.max(gochar.x0 + gochar.size, gochar.caption.x + gochar.caption.w) + gap;
    const w = Math.min(width - gap - x, minDim * 0.34);
    if (w < minDim * 0.14) return gochar;
    let top = gochar.caption.y;
    let bottom = Math.min(regionBottom, gochar.y0 + gochar.size * 1.5);
    for (const box of boxes.filter((b) => b.spec.corner.endsWith("right"))) {
      if (x + w <= box.x - gap / 2) continue;
      const zone = diagramZone(box);
      if (box.spec.corner.startsWith("top")) top = Math.max(top, zone.bottom + gap);
      else bottom = Math.min(bottom, zone.top - gap);
    }
    return bottom - top >= minDim * 0.15 ? { ...gochar, analysis: { x, y: top, w, h: bottom - top } } : gochar;
  };

  if (width > height) {
    // The gauge at the center of the image (or just below the header, if
    // that reaches lower); the gochar block in a column to the right,
    // which can start right below the top corner diagrams since it sits
    // beside the centered header rather than under it.
    const d = score != null ? Math.min(minDim * GAUGE_FRACTION, regionBottom - startY) : 0;
    const cx = width / 2;
    const cy = Math.min(Math.max(height / 2, startY + d / 2), regionBottom - d / 2);
    const rightEdge = width - (boxes[0].size + gap * 2);
    const gaugeRight = d ? cx + d / 2 + gap * 2 : cx + gap;
    // Two candidate columns for the gochar block, both right of the image's
    // center line: beside the header, from just below the top corner
    // diagrams; or (usually far roomier) from the center line itself, below
    // the header -- the chart then sits centered between the center line
    // and the right-hand diagrams. Whichever fits the larger chart wins.
    const columns = [
      { x0: Math.max(gaugeRight, params.headerRight + gap * 2), top: topZoneBottom + gap },
      { x0: gaugeRight, top: Math.max(topZoneBottom, params.headerBottom) + gap },
    ]
      .map((col) => ({ ...col, w: rightEdge - col.x0, h: regionBottom - col.top }))
      .filter((col) => col.w >= minDim * 0.15 && col.h > 0);

    // On a narrower desktop the column is narrower than the chart's ideal
    // size: rather than switching to the portrait stack, the whole block --
    // chart, caption text and prediction text -- shrinks in proportion.
    if (!params.hasKundli || columns.length) {
      let gocharLayout: GocharLayout | null = null;
      if (params.hasKundli) {
        let best: { block: Block; size: number; top: number } | null = null;
        for (const col of columns) {
          const textScale = Math.max(0.6, Math.min(1, col.w / (minDim * KUNDLI_FRACTION)));
          const blockOpts = { cx: col.x0 + col.w / 2, maxCaptionWidth: col.w, stripWidth: col.w, minDim, gap, facts, titleText, panchang: params.panchang, textScale };
          const fitted = await fitBlock(blockOpts, Math.min(minDim * KUNDLI_MAX_FRACTION, col.w), col.h);
          if (!best || fitted.size > best.size) best = { ...fitted, top: col.top };
        }
        const { block, top } = best!;
        gocharLayout = withAnalysis(block.place(Math.min(Math.max(cy - block.height / 2, top), regionBottom - block.height)));
      }
      return { gauge: d >= minDim * 0.05 ? { cx, cy, d } : null, gochar: gocharLayout };
    }
  }

  // Portrait stack (and narrow landscape): the gauge centered under the
  // header, the gochar block right on the luck meter, open space between.
  // The gochar's prediction strip runs between the bottom corner diagrams,
  // so it's only as wide as the space between them.
  let gocharLayout: GocharLayout | null = null;
  let gaugeBottom = regionBottom - gap;
  if (params.hasKundli) {
    const bottomLeft = boxes.find((b) => b.spec.corner === "bottom-left")!;
    const bottomRight = boxes.find((b) => b.spec.corner === "bottom-right")!;
    const stripWidth = bottomRight.x - gap - (bottomLeft.x + bottomLeft.size + gap);
    const blockOpts = { cx: width / 2, maxCaptionWidth: width * 0.9, stripWidth, minDim, gap, facts, titleText, panchang: params.panchang };
    // Room for the gauge above; on a short canvas the chart gives way.
    const roomForGauge = regionBottom - startY - (score != null ? minDim * GAUGE_FRACTION + gap * 2 : 0);
    // Mobile: as large as fits, never above the image's horizontal center
    // line, narrow enough to keep the Analysis panel beside it -- and, since
    // its lower part sits level with the bottom corner diagrams, no wider
    // than the space between them. Frame mode (flush) keeps the reference
    // size: on a wall-mounted frame the chart shouldn't take over half the
    // picture (the full-screen Luck Chart view is a click away).
    const maxHeight = flush ? roomForGauge : Math.min(roomForGauge, regionBottom - height / 2);
    const maxSize = flush
      ? minDim * KUNDLI_FRACTION
      : Math.max(minDim * KUNDLI_FRACTION, Math.min(minDim * KUNDLI_MAX_FRACTION, width - 2 * (minDim * ANALYSIS_MIN_FRACTION + gap * 2), stripWidth));
    const { block } = await fitBlock(blockOpts, maxSize, maxHeight);
    gocharLayout = withAnalysis(block.place(regionBottom - block.height));
    gaugeBottom = gocharLayout.caption.y - gap * 2;
  }
  const d = score != null ? Math.min(minDim * GAUGE_FRACTION, gaugeBottom - startY) : 0;
  // At the middle of the image, kept clear of the header above and the
  // gochar block below.
  const cy = Math.min(Math.max(height / 2, startY + d / 2), gaugeBottom - d / 2);
  const gauge = d >= minDim * 0.05 ? { cx: width / 2, cy, d } : null;
  return { gauge, gochar: gocharLayout };
}

/**
 * The full-screen Luck Chart view (opened by clicking the chart on the
 * wallpaper): just the gochar block -- caption, chart and Panchang strip --
 * and its Analysis panel, filling a `width`x`height` canvas.
 *
 * Landscape: the caption and chart take the full height on the left, as
 * large as fits; the Analysis and, under it, the Panchang strip share the
 * column to their right -- so the chart never has to shrink to leave room
 * for the strip below it. Portrait (or a landscape canvas too narrow for
 * that column): the block on top, the Analysis panel under it.
 */
export async function layoutLuckChartView(width: number, height: number, panchang: DailyReading["panchang"]): Promise<GocharLayout> {
  const minDim = Math.min(width, height);
  const gap = Math.round(minDim * 0.03);
  const [facts, titleText] = await Promise.all([shapePanchangFacts(panchang), shapeDevanagariText("भाग्य कुन्डली")]);

  if (width >= height * 1.15) {
    // The chart alone fills the height on the left; everything else -- the
    // caption (title, Panchang facts, colour legend), the Analysis and the
    // Panchang strip -- stacks in the column to its right, which keeps at
    // least 60% of the short side.
    const size = Math.min(height - gap * 2, width - gap * 3 - minDim * 0.6);
    if (size >= minDim * 0.4) {
      const column = { x: gap * 2 + size, w: width - gap * 3 - size };
      const block = await gocharBlock({ cx: gap + size / 2, size, maxCaptionWidth: column.w, stripWidth: column.w, minDim, gap, facts, titleText, panchang, textScale: 1.2 });
      const captionH = block.place(0).y0;
      const placed = block.place((height - size) / 2 - captionH);
      const caption = { x: column.x, y: gap, w: column.w, h: captionH };
      const strip = placed.strip ? { ...placed.strip, box: { x: column.x, y: height - gap - placed.strip.box.h, w: column.w, h: placed.strip.box.h } } : null;
      const analysisTop = caption.y + caption.h + gap;
      const analysisBottom = strip ? strip.box.y - gap : height - gap;
      return { ...placed, caption, strip, analysis: { x: column.x, y: analysisTop, w: column.w, h: analysisBottom - analysisTop } };
    }
  }

  // Portrait: the block on top, the Analysis panel under it.
  const textScale = Math.min(1.6, Math.max(1, (width - gap * 2) / (minDim * KUNDLI_FRACTION * 1.6)));
  const opts = { cx: width / 2, maxCaptionWidth: width - gap * 2, stripWidth: width - gap * 2, minDim, gap, facts, titleText, panchang, textScale };
  const { block } = await fitBlock(opts, width - gap * 2, height * 0.64);
  const placed = block.place(gap);
  const y = gap * 2 + block.height;
  return { ...placed, analysis: { x: gap, y, w: width - gap * 2, h: height - gap - y } };
}
