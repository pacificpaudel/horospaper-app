import type { DailyReading } from "@/lib/dailyReading";
import type { SchumannSnapshot } from "@/lib/schumann";
import type { ShapedText } from "./devanagariShaper";
import { luckMeterTop } from "./luckMeterOverlay";
import { diagramBoxes, diagramZone } from "./planetDiagram";
import { shapePanchangFacts, shapePanchangSummary } from "./panchangOverlay";
import { Box, chromeHeight, chromeWidth, graphChrome } from "./schumannOverlay";

// Where the middle of the wallpaper goes -- everything between the date
// header (with its 2 tags) and the luck meter: the Schumann calmness gauge,
// the live Schumann graph, and the gochar block (a "TODAY'S GOCHAR"
// caption with the day's Panchang facts on one line, the gochar chart, and
// the Panchang prediction as a strip below it). Laid out together in one
// place so no two of them can overlap each other or the corner diagrams.
//
// Portrait (mobile/frame): one column -- gauge, graph, gochar block.
// Landscape (desktop): there isn't the height for that, so the gauge sits
// at the center of the image with the graph to its left and the gochar
// block to its right. A landscape canvas too narrow for two columns falls
// back to the portrait stack.

/** 20% larger than the kundli's original 26% of the canvas's short side. */
const KUNDLI_FRACTION = 0.312;

export interface GocharLayout {
  /** The chart's square. */
  x0: number;
  y0: number;
  size: number;
  /** Caption backdrop above the chart: title row, then the Panchang facts row. */
  caption: Box;
  titleHeight: number;
  facts: { text: ShapedText; size: number } | null;
  /** The Panchang prediction below the chart, if there is one. */
  strip: { box: Box; lines: ShapedText[]; size: number; lineHeight: number; padY: number } | null;
}

export interface WallpaperLayout {
  gauge: { cx: number; cy: number; d: number } | null;
  graph: Box | null;
  /** The graph's base label size. */
  labelSize: number;
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
        facts: facts ? { text: facts, size: factsSize } : null,
        strip: lines.length ? { box: { x: cx - stripW / 2, y: y0 + size + stripGap, w: stripW, h: stripH }, lines, size: lineSize, lineHeight, padY } : null,
      };
    },
  };
}

export async function layoutWallpaper(params: {
  width: number;
  height: number;
  /** Bottom edge of the date header's tags panel. */
  headerBottom: number;
  flush: boolean;
  hasKundli: boolean;
  panchang: DailyReading["panchang"];
  snapshot: SchumannSnapshot | null | undefined;
}): Promise<WallpaperLayout> {
  const { width, height, flush, snapshot } = params;
  const minDim = Math.min(width, height);
  const gap = Math.round(minDim * 0.015);
  const luckTop = luckMeterTop(width, height);
  const boxes = diagramBoxes(width, height, flush);
  const topZoneBottom = Math.max(...boxes.filter((b) => b.spec.corner.startsWith("top")).map((b) => diagramZone(b).bottom));
  const facts = params.hasKundli ? await shapePanchangFacts(params.panchang) : null;
  const score = snapshot?.score ?? null;
  const graph = snapshot?.graph ?? null;
  const startY = params.headerBottom + gap;

  if (width > height) {
    const rowTop = startY;
    const rowBottom = luckTop - gap;
    const rowH = rowBottom - rowTop;
    const side = boxes[0].size + gap * 2;
    const d = score != null ? Math.min(minDim * 0.2, rowH) : 0;
    const cx = width / 2;
    const cy = Math.min(Math.max(height / 2, rowTop + d / 2), rowBottom - d / 2);
    const inner = d ? d / 2 + gap * 2 : gap;
    const colW = Math.min(cx - inner - side, width - side - (cx + inner));

    if (colW >= minDim * 0.33) {
      const l = Math.max(11, minDim * 0.014);
      let gocharLayout: GocharLayout | null = null;
      if (params.hasKundli) {
        const blockOpts = { cx: cx + inner + colW / 2, maxCaptionWidth: colW, stripWidth: colW, minDim, gap, facts, panchang: params.panchang };
        let size = Math.min(Math.round(minDim * KUNDLI_FRACTION), colW);
        let block = await gocharBlock({ ...blockOpts, size });
        if (block.height > rowH) {
          // The chart (and its title row, 10% of it) is what gives way.
          size = Math.max(minDim * 0.15, size - (block.height - rowH) / 1.1);
          block = await gocharBlock({ ...blockOpts, size });
        }
        gocharLayout = block.place(Math.min(Math.max(cy - block.height / 2, rowTop), rowBottom - block.height));
      }

      let graphBox: Box | null = null;
      if (graph) {
        const c = graphChrome(l, graph.cropped);
        const plotH = Math.min((colW - chromeWidth(c)) / (graph.cropped ? 1.6 : graph.width / graph.height), rowH - chromeHeight(c));
        if (plotH >= minDim * 0.07) {
          const h = chromeHeight(c) + plotH;
          graphBox = { x: cx - inner - colW, y: Math.min(Math.max(cy - h / 2, rowTop), rowBottom - h), w: colW, h };
        }
      }
      return { gauge: d ? { cx, cy, d } : null, graph: graphBox, labelSize: l, gochar: gocharLayout };
    }
  }

  // Portrait stack (and narrow landscape): the gochar block sits right on
  // the luck meter; its prediction strip runs between the bottom corner
  // diagrams, so it's only as wide as the space between them.
  let gocharLayout: GocharLayout | null = null;
  let regionBottom = luckTop - gap * 2;
  if (params.hasKundli) {
    const bottomLeft = boxes.find((b) => b.spec.corner === "bottom-left")!;
    const bottomRight = boxes.find((b) => b.spec.corner === "bottom-right")!;
    const stripWidth = bottomRight.x - gap - (bottomLeft.x + bottomLeft.size + gap);
    const block = await gocharBlock({
      cx: width / 2,
      size: Math.round(minDim * KUNDLI_FRACTION),
      maxCaptionWidth: width * 0.9,
      stripWidth,
      minDim,
      gap,
      facts,
      panchang: params.panchang,
    });
    gocharLayout = block.place(luckTop - gap - block.height);
    regionBottom = gocharLayout.caption.y - gap * 2;
  }

  const l = Math.max(11, minDim * 0.015);
  const avail = regionBottom - startY;
  const c = graph ? graphChrome(l, graph.cropped) : null;
  const graphW = Math.min(width * 0.94, minDim * 1.6);
  const aspect = graph ? (graph.cropped ? 2.0 : graph.width / graph.height) : 1;
  let plotH = graph && c ? (graphW - chromeWidth(c)) / aspect : 0;
  let gaugeD = score != null ? minDim * 0.22 : 0;
  const graphH = () => (graph && c ? gap + chromeHeight(c) + plotH : 0);
  // Out of room: shrink the gauge first (down to a floor), then the plot.
  if (gaugeD + graphH() > avail) gaugeD = Math.max(score != null ? minDim * 0.14 : 0, avail - graphH());
  if (gaugeD + graphH() > avail && c) plotH = avail - gaugeD - gap - chromeHeight(c);
  const showGraph = Boolean(graph && c) && plotH >= minDim * 0.07;
  gaugeD = Math.min(gaugeD, avail - (showGraph ? graphH() : 0));
  const gauge = gaugeD >= minDim * 0.1 ? { cx: width / 2, cy: startY + gaugeD / 2, d: gaugeD } : null;
  // Full width, so it must also clear the top corner diagrams' names.
  const graphTop = Math.max(gauge ? startY + gaugeD + gap : startY, topZoneBottom + gap);
  const graphBox = showGraph && c && graphTop + chromeHeight(c) + plotH <= regionBottom ? { x: (width - graphW) / 2, y: graphTop, w: graphW, h: chromeHeight(c) + plotH } : null;
  return { gauge, graph: graphBox, labelSize: l, gochar: gocharLayout };
}
