import { ImageStyle } from "@/types/enums";
import { StructuredAstrologyData } from "@/lib/astrology";
import { saveGeneratedFile } from "@/lib/storage";
import { buildImagePrompt } from "./prompt";
import { generateMockHoroscopeImageSvg } from "./mockImage";
import { DailyReading } from "@/lib/dailyReading";
import { generateOpenverseImage } from "./openverseImage";
import { withWallpaperOverlay, TargetCanvas } from "./compositeOverlay";
import { createHash } from "node:crypto";

const IMAGE_GENERATOR_VERSION = "daily-image-v18";

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

export interface GeneratedImage {
  url: string;
  mobileUrl: string;
  frameUrl: string;
  prompt: string;
  provider: "openai" | "openverse" | "mock";
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
}): Promise<GeneratedImage> {
  const { stableSeed, astrology, reading, style, luckyTheme, emotionalTheme, desktopRatio, randomizeArt } = params;
  const DESKTOP_TARGET = desktopTargetFor(desktopRatio);
  const assetId = createHash("sha256").update(stableSeed).digest("hex").slice(0, 24);
  const prompt = buildImagePrompt(astrology, { style, luckyTheme, emotionalTheme });
  const provider = process.env.IMAGE_PROVIDER === "openai" && process.env.OPENAI_API_KEY ? "openai" : "openverse";

  if (provider === "openai") {
    try {
      const { generateWithOpenAIImage } = await import("./openaiImage");
      const buffer = await generateWithOpenAIImage(prompt);
      const [desktop, mobile, frame] = await Promise.all([
        withWallpaperOverlay(buffer, astrology, reading, DESKTOP_TARGET),
        withWallpaperOverlay(buffer, astrology, reading, MOBILE_TARGET),
        withWallpaperOverlay(buffer, astrology, reading, FRAME_TARGET, true),
      ]);
      const [{ url }, { url: mobileUrl }, { url: frameUrl }] = await Promise.all([
        saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}.png`, desktop, "image/png"),
        saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}-mobile.png`, mobile, "image/png"),
        saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}-frame.png`, frame, "image/png"),
      ]);
      return { url, mobileUrl, frameUrl, prompt, provider };
    } catch (err) {
      console.error("[image] openai generation failed, falling back to mock:", err);
    }
  }

  try {
    const result = await generateOpenverseImage({ stableSeed, intent: reading.intent, randomize: randomizeArt });
    const [desktop, mobile, frame] = await Promise.all([
      withWallpaperOverlay(result.buffer, astrology, reading, DESKTOP_TARGET),
      withWallpaperOverlay(result.buffer, astrology, reading, MOBILE_TARGET),
      withWallpaperOverlay(result.buffer, astrology, reading, FRAME_TARGET, true),
    ]);
    const [{ url }, { url: mobileUrl }, { url: frameUrl }] = await Promise.all([
      saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}.${result.extension}`, desktop, result.contentType),
      saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}-mobile.${result.extension}`, mobile, result.contentType),
      saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}-frame.${result.extension}`, frame, result.contentType),
    ]);
    return { url, mobileUrl, frameUrl, prompt: result.prompt, provider: "openverse" };
  } catch (err) {
    console.error("[image] Openverse generation failed, falling back to local art:", err);
  }

  const svgOpts = {
    seed: stableSeed,
    style,
    luckScore: reading.luckScore,
    intent: reading.intent,
    kundli: reading.kundli,
    panchang: reading.panchang,
    astrology,
    luckyTheme,
    emotionalTheme,
    moonIllumination: astrology.today.moonIllumination,
  };
  const svg = generateMockHoroscopeImageSvg({ ...svgOpts, target: DESKTOP_TARGET });
  const mobileSvg = generateMockHoroscopeImageSvg({ ...svgOpts, target: MOBILE_TARGET });
  const frameSvg = generateMockHoroscopeImageSvg({ ...svgOpts, target: FRAME_TARGET, flushPlanets: true });
  const [{ url }, { url: mobileUrl }, { url: frameUrl }] = await Promise.all([
    saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}.svg`, svg, "image/svg+xml"),
    saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}-mobile.svg`, mobileSvg, "image/svg+xml"),
    saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}-frame.svg`, frameSvg, "image/svg+xml"),
  ]);
  return { url, mobileUrl, frameUrl, prompt, provider: "mock" };
}
