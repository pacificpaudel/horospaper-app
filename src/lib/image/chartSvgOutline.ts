import { DEVANAGARI_LABELS } from "./devanagariLabels";

// Makes freeastrologyapi.com's kundli SVG renderable without fonts: every
// <text> is swapped for the pre-shaped outline of the same string at the
// same position, size and colour, and the web-font @import is dropped. The
// chart's lines and layout are left exactly as the API drew them, so the
// wallpaper and the form show the identical chart.

function attr(attrs: string, name: string): string | null {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1] ?? null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

/**
 * The API's chart SVG with all text outlined, or null if it contains a
 * string there's no outline for (callers then fall back).
 */
export function outlineChartSvg(svg: string): string | null {
  let unknown = false;
  const outlined = svg
    .replace(/<style>[\s\S]*?<\/style>/g, "")
    // Defensive: nothing executable should ever ride along into our pages.
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/<text([^>]*)>([^<]*)<\/text>/g, (_, attrs: string, content: string) => {
      const text = decodeEntities(content).trim();
      if (!text) return "";
      const glyph = DEVANAGARI_LABELS[text];
      const x = Number(attr(attrs, "x"));
      const y = Number(attr(attrs, "y"));
      const fontSize = parseFloat(attr(attrs, "font-size") ?? "");
      if (!glyph || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(fontSize)) {
        unknown = true;
        return "";
      }
      const fill = /fill:\s*([^;"]+)/.exec(attr(attrs, "style") ?? "")?.[1]?.trim() ?? attr(attrs, "fill") ?? "#000000";
      const anchor = attr(attrs, "text-anchor");
      const width = glyph.width * fontSize;
      const left = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
      return `<path d="${glyph.d}" fill="${fill}" transform="translate(${left} ${y}) scale(${fontSize})" />`;
    });
  return unknown ? null : outlined;
}

/** Nests an outlined chart SVG at (x, y), scaled into a `size`-sided square. */
export function embedChartSvg(svg: string, x: number, y: number, size: number): string {
  const open = /<svg\b[^>]*>/.exec(svg)?.[0];
  if (!open) return "";
  const width = Number(attr(open, "width")) || 400;
  const height = Number(attr(open, "height")) || 400;
  const nestedOpen = `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size}" height="${size}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">`;
  return svg.replace(open, nestedOpen);
}
