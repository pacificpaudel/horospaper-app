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
// gochar block on the luck meter. Landscape (desktop): the gauge at the
// center of the image and the gochar block in a column to its right. A
// landscape canvas too narrow for that column falls back to the portrait
// arrangement.

/** 20% larger than the kundli's original 26% of the canvas's short side. */
const KUNDLI_FRACTION = 0.312;
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
  /** "भाग्य कुन्डली", shaped -- the Devanagari half of the caption's title. */
  titleText: ShapedText;
  facts: { text: ShapedText; size: number } | null;
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
}): Promise<Block> {
  const { cx, size, minDim, facts } = opts;
  const titleHeight = size * 0.1;
  const factsPad = minDim * 0.03;
  const factsSize = facts ? Math.min(minDim * 0.022, (opts.maxCaptionWidth - factsPad * 2) / facts.width) : 0;
  const captionH = titleHeight + (facts ? factsSize * 1.75 : 0);
  const captionW = Math.min(opts.maxCaptionWidth, Math.max(size, facts ? facts.width * factsSize + factsPad * 2 : 0));

  const lineSize = minDim * 0.025;
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
        titleHeight,
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

  if (width > height) {
    // The gauge at the center of the image (or just below the header, if
    // that reaches lower); the gochar block in a column to the right,
    // which can start right below the top corner diagrams since it sits
    // beside the centered header rather than under it.
    const d = score != null ? Math.min(minDim * GAUGE_FRACTION, regionBottom - startY) : 0;
    const cx = width / 2;
    const cy = Math.min(Math.max(height / 2, startY + d / 2), regionBottom - d / 2);
    const colTop = topZoneBottom + gap;
    const colX0 = Math.max(d ? cx + d / 2 + gap * 2 : cx, params.headerRight + gap * 2);
    const colW = width - (boxes[0].size + gap * 2) - colX0;
    const colH = regionBottom - colTop;

    if (!params.hasKundli || colW >= minDim * 0.24) {
      let gocharLayout: GocharLayout | null = null;
      if (params.hasKundli) {
        const blockOpts = { cx: colX0 + colW / 2, maxCaptionWidth: colW, stripWidth: colW, minDim, gap, facts, titleText, panchang: params.panchang };
        let size = Math.min(Math.round(minDim * KUNDLI_FRACTION), colW);
        let block = await gocharBlock({ ...blockOpts, size });
        if (block.height > colH) {
          // The chart (and its title row, 10% of it) is what gives way.
          size = Math.max(minDim * 0.15, size - (block.height - colH) / 1.1);
          block = await gocharBlock({ ...blockOpts, size });
        }
        gocharLayout = block.place(Math.min(Math.max(cy - block.height / 2, colTop), regionBottom - block.height));
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
    let size = Math.round(minDim * KUNDLI_FRACTION);
    let block = await gocharBlock({ ...blockOpts, size });
    // Keep room for the gauge above; on a short canvas the chart gives way.
    const maxHeight = regionBottom - startY - (score != null ? minDim * GAUGE_FRACTION + gap * 2 : 0);
    if (block.height > maxHeight) {
      size = Math.max(minDim * 0.15, size - (block.height - maxHeight) / 1.1);
      block = await gocharBlock({ ...blockOpts, size });
    }
    gocharLayout = block.place(regionBottom - block.height);
    gaugeBottom = gocharLayout.caption.y - gap * 2;
  }
  const d = score != null ? Math.min(minDim * GAUGE_FRACTION, gaugeBottom - startY) : 0;
  // At the middle of the image, kept clear of the header above and the
  // gochar block below.
  const cy = Math.min(Math.max(height / 2, startY + d / 2), gaugeBottom - d / 2);
  const gauge = d >= minDim * 0.05 ? { cx: width / 2, cy, d } : null;
  return { gauge, gochar: gocharLayout };
}
