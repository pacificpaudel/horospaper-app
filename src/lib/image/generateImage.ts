import { ImageStyle } from "@/types/enums";
import { StructuredAstrologyData } from "@/lib/astrology";
import { saveGeneratedFile } from "@/lib/storage";
import { buildImagePrompt } from "./prompt";
import { generateMockHoroscopeImageSvg } from "./mockImage";
import { deriveDailyIntent } from "./dailyIntent";
import { generateOpenverseImage } from "./openverseImage";
import { withPlanetOverlay, TargetCanvas } from "./compositeOverlay";
import { createHash } from "node:crypto";

const IMAGE_GENERATOR_VERSION = "daily-image-v5";

// A common phone-wallpaper canvas. The desktop/default image keeps whatever
// aspect ratio its source naturally has (unchanged); this variant is
// smart-cropped to a shape that actually fills a phone lock/home screen
// instead of being cropped unpredictably by the OS after download.
const MOBILE_TARGET: TargetCanvas = { width: 1080, height: 1920 };

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
}): Promise<GeneratedImage> {
  const { stableSeed, astrology, luckScore, style, luckyTheme, emotionalTheme } = params;
  const assetId = createHash("sha256").update(stableSeed).digest("hex").slice(0, 24);
  const prompt = buildImagePrompt(astrology, { style, luckyTheme, emotionalTheme });
  const provider = process.env.IMAGE_PROVIDER === "openai" && process.env.OPENAI_API_KEY ? "openai" : "openverse";

  if (provider === "openai") {
    try {
      const { generateWithOpenAIImage } = await import("./openaiImage");
      const buffer = await generateWithOpenAIImage(prompt);
      const [desktop, mobile] = await Promise.all([
        withPlanetOverlay(buffer, astrology),
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
      withPlanetOverlay(result.buffer, astrology),
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
  const svg = generateMockHoroscopeImageSvg(svgOpts);
  const mobileSvg = generateMockHoroscopeImageSvg({ ...svgOpts, target: MOBILE_TARGET });
  const [{ url }, { url: mobileUrl }] = await Promise.all([
    saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}.svg`, svg, "image/svg+xml"),
    saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}-mobile.svg`, mobileSvg, "image/svg+xml"),
  ]);
  return { url, mobileUrl, prompt, provider: "mock" };
}
