import { StructuredAstrologyData } from "@/lib/astrology";
import { buildPlanetOverlaySvg } from "./planetDiagram";

export interface TargetCanvas {
  width: number;
  height: number;
}

/**
 * Composites the 4 planet-position diagrams onto a raster image (JPEG/PNG/WEBP).
 * With no `target`, the image's own dimensions are used untouched (the
 * desktop/default path). With a `target`, the source is first smart-cropped
 * to fill that canvas exactly -- used to produce a phone-wallpaper-shaped
 * variant from whatever aspect ratio the source photo happens to be.
 */
export async function withPlanetOverlay(
  image: Buffer,
  astrology: StructuredAstrologyData,
  target?: TargetCanvas
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

  const overlay = buildPlanetOverlaySvg(astrology, width, height);
  return base.composite([{ input: Buffer.from(overlay), top: 0, left: 0 }]).toBuffer();
}
