import { ImageStyle } from "@/types/enums";
import { StructuredAstrologyData } from "@/lib/astrology";
import { saveGeneratedFile } from "@/lib/storage";
import { buildImagePrompt } from "./prompt";
import { generateMockHoroscopeImageSvg } from "./mockImage";
import { deriveDailyIntent } from "./dailyIntent";
import { generateOpenverseImage } from "./openverseImage";
import { withPlanetOverlay, TargetCanvas } from "./compositeOverlay";
import { createHash } from "node:crypto";

const IMAGE_GENERATOR_VERSION = "daily-image-v8";

// Source images (a random-aspect-ratio Openverse photo, OpenAI's fixed
// portrait size, or the mock SVG's native 4:5) rarely match either wallpaper
// shape on their own, so both variants are smart-cropped to a fixed canvas
// and the corner diagrams are drawn fresh on that final canvas -- never on
// the untouched source -- so they always land exactly at the 4 edges of the
// image that actually gets shown, with no further cropping happening after
// the fact (in CSS or in an OS's "set as wallpaper" crop).
const MOBILE_TARGET: TargetCanvas = { width: 1080, height: 1920 };
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
  luckScore: number;
  style: ImageStyle;
  luckyTheme: string;
  emotionalTheme: string;
  desktopRatio?: number;
}): Promise<GeneratedImage> {
  const { stableSeed, astrology, luckScore, style, luckyTheme, emotionalTheme, desktopRatio } = params;
  const DESKTOP_TARGET = desktopTargetFor(desktopRatio);
  const assetId = createHash("sha256").update(stableSeed).digest("hex").slice(0, 24);
  const prompt = buildImagePrompt(astrology, { style, luckyTheme, emotionalTheme });
  const provider = process.env.IMAGE_PROVIDER === "openai" && process.env.OPENAI_API_KEY ? "openai" : "openverse";

  if (provider === "openai") {
    try {
      const { generateWithOpenAIImage } = await import("./openaiImage");
      const buffer = await generateWithOpenAIImage(prompt);
      const [desktop, mobile] = await Promise.all([
        withPlanetOverlay(buffer, astrology, DESKTOP_TARGET),
        withPlanetOverlay(buffer, astrology, MOBILE_TARGET),
      ]);
      const [{ url }, { url: mobileUrl }] = await Promise.all([
        saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}.png`, desktop, "image/png"),
        saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}-mobile.png`, mobile, "image/png"),
      ]);
      return { url, mobileUrl, prompt, provider };
    } catch (err) {
      console.error("[image] openai generation failed, falling back to mock:", err);
    }
  }

  try {
    const result = await generateOpenverseImage({ stableSeed, intent: deriveDailyIntent(astrology) });
    const [desktop, mobile] = await Promise.all([
      withPlanetOverlay(result.buffer, astrology, DESKTOP_TARGET),
      withPlanetOverlay(result.buffer, astrology, MOBILE_TARGET),
    ]);
    const [{ url }, { url: mobileUrl }] = await Promise.all([
      saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}.${result.extension}`, desktop, result.contentType),
      saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}-mobile.${result.extension}`, mobile, result.contentType),
    ]);
    return { url, mobileUrl, prompt: result.prompt, provider: "openverse" };
  } catch (err) {
    console.error("[image] Openverse generation failed, falling back to local art:", err);
  }

  const svgOpts = {
    seed: stableSeed,
    style,
    luckScore,
    astrology,
    luckyTheme,
    emotionalTheme,
    moonIllumination: astrology.today.moonIllumination,
  };
  const svg = generateMockHoroscopeImageSvg({ ...svgOpts, target: DESKTOP_TARGET });
  const mobileSvg = generateMockHoroscopeImageSvg({ ...svgOpts, target: MOBILE_TARGET });
  const [{ url }, { url: mobileUrl }] = await Promise.all([
    saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}.svg`, svg, "image/svg+xml"),
    saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}-mobile.svg`, mobileSvg, "image/svg+xml"),
  ]);
  return { url, mobileUrl, prompt, provider: "mock" };
}
