import { ImageStyle } from "@prisma/client";
import { StructuredAstrologyData } from "@/lib/astrology";
import { saveGeneratedFile } from "@/lib/storage";
import { buildImagePrompt } from "./prompt";
import { generateMockHoroscopeImageSvg } from "./mockImage";
import { deriveDailyIntent } from "./dailyIntent";
import { generateOpenverseImage } from "./openverseImage";
import { createHash } from "node:crypto";

const IMAGE_GENERATOR_VERSION = "daily-image-v1";

export interface GeneratedImage {
  url: string;
  prompt: string;
  provider: "openai" | "openverse" | "mock";
}

/**
 * Generates (or procedurally mocks) the horoscope artwork and stores it,
 * returning a public URL. Image generation only ever runs once per
 * horoscope unless the user explicitly requests a regeneration.
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
      const { url } = await saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}.png`, buffer, "image/png");
      return { url, prompt, provider };
    } catch (err) {
      console.error("[image] openai generation failed, falling back to mock:", err);
    }
  }

  try {
    const result = await generateOpenverseImage({
      assetId,
      stableSeed,
      intent: deriveDailyIntent(astrology),
    });
    return { ...result, provider: "openverse" };
  } catch (err) {
    console.error("[image] Openverse generation failed, falling back to local art:", err);
  }

  const svg = generateMockHoroscopeImageSvg({
    seed: stableSeed,
    style,
    luckScore,
    astrology,
    luckyTheme,
    emotionalTheme,
    moonIllumination: astrology.today.moonIllumination,
  });
  const { url } = await saveGeneratedFile(`${assetId}-${IMAGE_GENERATOR_VERSION}.svg`, svg, "image/svg+xml");
  return { url, prompt, provider: "mock" };
}
