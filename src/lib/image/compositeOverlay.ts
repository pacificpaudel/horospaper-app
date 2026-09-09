import { StructuredAstrologyData } from "@/lib/astrology";
import { buildPlanetOverlaySvg } from "./planetDiagram";

/** Composites the 4 planet-position diagrams onto a raster image (JPEG/PNG/WEBP). */
export async function withPlanetOverlay(image: Buffer, astrology: StructuredAstrologyData): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const base = sharp(image);
  const metadata = await base.metadata();
  const width = metadata.width ?? 1080;
  const height = metadata.height ?? 1350;
  const overlay = buildPlanetOverlaySvg(astrology, width, height);

  return base.composite([{ input: Buffer.from(overlay), top: 0, left: 0 }]).toBuffer();
}
