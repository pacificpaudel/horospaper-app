import { Language } from "@/types/enums";
import { StructuredAstrologyData } from "@/lib/astrology";
import { buildHoroscopePrompt } from "./prompt";
import { generateMockHoroscope } from "./mockProvider";
import { HoroscopeSections } from "./types";

type Provider = "anthropic" | "openai" | "mock";

function resolveProvider(): Provider {
  const configured = (process.env.LLM_PROVIDER || "").toLowerCase();
  if (configured === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (configured === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (!configured) {
    if (process.env.ANTHROPIC_API_KEY) return "anthropic";
    if (process.env.OPENAI_API_KEY) return "openai";
  }
  return "mock";
}

export async function generateHoroscope(
  astrology: StructuredAstrologyData,
  opts: { name?: string | null; language: Language }
): Promise<{ sections: HoroscopeSections; provider: Provider }> {
  const provider = resolveProvider();

  if (provider === "mock") {
    console.info("[llm] MOCK mode -- no LLM API key configured, using template generator");
    return { sections: generateMockHoroscope(astrology, opts.name), provider };
  }

  const prompt = buildHoroscopePrompt(astrology, opts);

  try {
    if (provider === "anthropic") {
      const { generateWithAnthropic } = await import("./anthropicProvider");
      return { sections: await generateWithAnthropic(prompt), provider };
    }
    const { generateWithOpenAI } = await import("./openaiProvider");
    return { sections: await generateWithOpenAI(prompt), provider };
  } catch (err) {
    console.error(`[llm] ${provider} generation failed, falling back to mock:`, err);
    return { sections: generateMockHoroscope(astrology, opts.name), provider: "mock" };
  }
}
