import { ImageStyle } from "@/types/enums";
import { StructuredAstrologyData } from "@/lib/astrology";
import { readGeneratedFile, saveGeneratedFile } from "@/lib/storage";
import { buildImagePrompt } from "./prompt";
import { generateMockHoroscopeImageSvg } from "./mockImage";
import { DailyReading } from "@/lib/dailyReading";
import { generateOpenverseImage } from "./openverseImage";
import { readingTags, withWallpaperOverlay, TargetCanvas } from "./compositeOverlay";
import { getSchumannSnapshot } from "@/lib/schumann";
import type { SchumannView } from "./schumannOverlay";
import { createHash } from "node:crypto";

const IMAGE_GENERATOR_VERSION = "daily-image-v30";

// Source images (a random-aspect-ratio Openverse photo, OpenAI's fixed
// portrait size, or the mock SVG's native 4:5) rarely match either wallpaper
// shape on their own, so both variants are smart-cropped to a fixed canvas
// and the corner diagrams are drawn fresh on that final canvas -- never on
// the untouched source -- so they always land exactly at the 4 edges of the
// image that actually gets shown, with no further cropping happening after
// the fact (in CSS or in an OS's "set as wallpaper" crop).
const MOBILE_TARGET: TargetCanvas = { width: 1080, height: 1920 };
// Frame mode targets an always-on device mounted like a vertical tablet
// (a 16:9 panel turned portrait, i.e. 9:16) -- same shape as MOBILE_TARGET,
// but rendered as its own asset with the planet diagrams flush to all 4
// edges (see planetDiagram.ts's `flush` option), since this variant is only
// ever shown inside the app's own object-fit: contain fullscreen display,
// never downloaded to risk being cover-cropped by a native OS wallpaper
// setter the way the mobile-download variant can be.
const FRAME_TARGET: TargetCanvas = { width: 1080, height: 1920 };
const DESKTOP_HEIGHT = 1080;
const DESKTOP_FALLBACK_RATIO = 16 / 9;
const DESKTOP_MIN_RATIO = 1.1;
const DESKTOP_MAX_RATIO = 3.2;

/**
 * The desktop canvas's width/height ratio is picked to match the caller's
 * actual on-screen viewport (minus header/footer chrome) at generation
 * time, so the displayed frame needs no letterboxing or further cropping --
 * it's simply shown at this exact ratio. Falls back to 16:9 when the caller
 * didn't report one (e.g. the frame-mode daily auto-refresh).
 */
function desktopTargetFor(ratio?: number): TargetCanvas {
  const safeRatio = ratio && Number.isFinite(ratio) ? ratio : DESKTOP_FALLBACK_RATIO;
  const clamped = Math.min(DESKTOP_MAX_RATIO, Math.max(DESKTOP_MIN_RATIO, safeRatio));
  return { width: Math.round(DESKTOP_HEIGHT * clamped), height: DESKTOP_HEIGHT };
}

/**
 * What the wallpaper's overlays are drawn on top of, kept with the
 * horoscope so the overlays can be redrawn later (the hourly Schumann
 * refresh) on the exact same artwork: the stored clean photo, or the seed
 * the local SVG artwork is generated from.
 */
export type WallpaperSource =
  | { kind: "raster"; url: string; contentType: string; extension: string }
  | { kind: "mock"; seed: string };

export interface GeneratedImage {
  url: string;
  mobileUrl: string;
  frameUrl: string;
  prompt: string;
  provider: "openai" | "openverse" | "mock";
  source: WallpaperSource;
  /** UTC hour of the Schumann data drawn on it (see schumann.ts). */
  schumannHour: string;
}

interface OverlayContext {
  assetId: string;
  astrology: StructuredAstrologyData;
  reading: DailyReading;
  style: ImageStyle;
  luckyTheme: string;
  emotionalTheme: string;
  desktopRatio?: number;
  /** This hour's Schumann data, drawn in the viewer's own time zone. */
  schumann: SchumannView;
}

// The Schumann hour is part of every filename: files are served as
// immutable, so a refreshed wallpaper needs a new URL to be picked up.
const fileStem = (ctx: OverlayContext) => `${ctx.assetId}-${IMAGE_GENERATOR_VERSION}-${ctx.schumann.snapshot.hour.replace(/\D/g, "")}`;

async function renderRaster(buffer: Buffer, contentType: string, extension: string, ctx: OverlayContext) {
  const { astrology, reading, schumann } = ctx;
  const [desktop, mobile, frame] = await Promise.all([
    withWallpaperOverlay(buffer, astrology, reading, desktopTargetFor(ctx.desktopRatio), false, schumann),
    withWallpaperOverlay(buffer, astrology, reading, MOBILE_TARGET, false, schumann),
    withWallpaperOverlay(buffer, astrology, reading, FRAME_TARGET, true, schumann),
  ]);
  const stem = fileStem(ctx);
  const [{ url }, { url: mobileUrl }, { url: frameUrl }] = await Promise.all([
    saveGeneratedFile(`${stem}.${extension}`, desktop, contentType),
    saveGeneratedFile(`${stem}-mobile.${extension}`, mobile, contentType),
    saveGeneratedFile(`${stem}-frame.${extension}`, frame, contentType),
  ]);
  return { url, mobileUrl, frameUrl };
}

async function renderMock(seed: string, ctx: OverlayContext) {
  const { astrology, reading } = ctx;
  const svgOpts = {
    seed,
    style: ctx.style,
    luckScore: reading.luckScore,
    intent: reading.intent,
    kundli: reading.kundli,
    panchang: reading.panchang,
    astrology,
    luckyTheme: ctx.luckyTheme,
    emotionalTheme: ctx.emotionalTheme,
    moonIllumination: astrology.today.moonIllumination,
    schumann: ctx.schumann,
    tags: readingTags(reading),
    zodiacSign: reading.rashi?.sign,
  };
  const [svg, mobileSvg, frameSvg] = await Promise.all([
    generateMockHoroscopeImageSvg({ ...svgOpts, target: desktopTargetFor(ctx.desktopRatio) }),
    generateMockHoroscopeImageSvg({ ...svgOpts, target: MOBILE_TARGET }),
    generateMockHoroscopeImageSvg({ ...svgOpts, target: FRAME_TARGET, flushPlanets: true }),
  ]);
  const stem = fileStem(ctx);
  const [{ url }, { url: mobileUrl }, { url: frameUrl }] = await Promise.all([
    saveGeneratedFile(`${stem}.svg`, svg, "image/svg+xml"),
    saveGeneratedFile(`${stem}-mobile.svg`, mobileSvg, "image/svg+xml"),
    saveGeneratedFile(`${stem}-frame.svg`, frameSvg, "image/svg+xml"),
  ]);
  return { url, mobileUrl, frameUrl };
}

/** Stores the clean, overlay-free photo so later hourly redraws reuse it exactly. */
async function saveSource(assetId: string, buffer: Buffer, contentType: string, extension: string): Promise<WallpaperSource> {
  const { url } = await saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}-source.${extension}`, buffer, contentType);
  return { kind: "raster", url, contentType, extension };
}

/**
 * Generates (or procedurally mocks) the horoscope artwork and stores it,
 * returning public URLs for a desktop-shaped and a mobile-wallpaper-shaped
 * variant. Image generation only ever runs once per horoscope unless the
 * user explicitly requests a regeneration.
 */
export async function generateHoroscopeImage(params: {
  horoscopeId: string;
  stableSeed: string;
  astrology: StructuredAstrologyData;
  reading: DailyReading;
  style: ImageStyle;
  luckyTheme: string;
  emotionalTheme: string;
  desktopRatio?: number;
  randomizeArt?: boolean;
  /** IANA zone the Schumann graph is labelled in. */
  timeZone: string;
}): Promise<GeneratedImage> {
  const { stableSeed, astrology, style, luckyTheme, emotionalTheme, randomizeArt } = params;
  const assetId = createHash("sha256").update(stableSeed).digest("hex").slice(0, 24);
  const prompt = buildImagePrompt(astrology, { style, luckyTheme, emotionalTheme });
  const provider = process.env.IMAGE_PROVIDER === "openai" && process.env.OPENAI_API_KEY ? "openai" : "openverse";
  const snapshot = await getSchumannSnapshot();
  const ctx: OverlayContext = { ...params, assetId, schumann: { snapshot, timeZone: params.timeZone, now: new Date() } };

  if (provider === "openai") {
    try {
      const { generateWithOpenAIImage } = await import("./openaiImage");
      const buffer = await generateWithOpenAIImage(prompt);
      const [urls, source] = await Promise.all([renderRaster(buffer, "image/png", "png", ctx), saveSource(assetId, buffer, "image/png", "png")]);
      return { ...urls, prompt, provider, source, schumannHour: snapshot.hour };
    } catch (err) {
      console.error("[image] openai generation failed, falling back to mock:", err);
    }
  }

  try {
    const result = await generateOpenverseImage({ stableSeed, intent: params.reading.intent, randomize: randomizeArt });
    const [urls, source] = await Promise.all([
      renderRaster(result.buffer, result.contentType, result.extension, ctx),
      saveSource(assetId, result.buffer, result.contentType, result.extension),
    ]);
    return { ...urls, prompt: result.prompt, provider: "openverse", source, schumannHour: snapshot.hour };
  } catch (err) {
    console.error("[image] Openverse generation failed, falling back to local art:", err);
  }

  const urls = await renderMock(stableSeed, ctx);
  return { ...urls, prompt, provider: "mock", source: { kind: "mock", seed: stableSeed }, schumannHour: snapshot.hour };
}

/**
 * Redraws an existing wallpaper's overlays on its original artwork with
 * this hour's Schumann data -- no new photo, LLM or astrology work.
 */
export async function rerenderHoroscopeImage(params: {
  source: WallpaperSource;
  astrology: StructuredAstrologyData;
  reading: DailyReading;
  style: ImageStyle;
  luckyTheme: string;
  emotionalTheme: string;
  desktopRatio?: number;
  timeZone: string;
}): Promise<{ url: string; mobileUrl: string; frameUrl: string; schumannHour: string }> {
  const { source } = params;
  const assetId = createHash("sha256")
    .update(source.kind === "raster" ? source.url : source.seed)
    .digest("hex")
    .slice(0, 24);
  const snapshot = await getSchumannSnapshot();
  const ctx: OverlayContext = { ...params, assetId, schumann: { snapshot, timeZone: params.timeZone, now: new Date() } };
  const urls =
    source.kind === "raster"
      ? await renderRaster(await readGeneratedFile(source.url), source.contentType, source.extension, ctx)
      : await renderMock(source.seed, ctx);
  return { ...urls, schumannHour: snapshot.hour };
}
