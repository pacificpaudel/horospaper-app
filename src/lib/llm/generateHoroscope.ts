import { Language } from "@/types/enums";
import { StructuredAstrologyData } from "@/lib/astrology";
import { buildHoroscopePrompt } from "./prompt";
import { generateMockHoroscope } from "./mockProvider";
import { HoroscopeSections } from "./types";

export type Provider = "anthropic" | "openai" | "gemini" | "mock";

const REAL_PROVIDERS = ["anthropic", "openai", "gemini"] as const;
type RealProvider = (typeof REAL_PROVIDERS)[number];

function hasKey(provider: RealProvider): boolean {
  if (provider === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY);
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Every configured provider, in the order to try them: LLM_PROVIDER's
 * choice first (if it actually has a key), then every other provider that
 * has a key, ending in "mock". A provider whose key is merely *present*
 * but broken (expired, out of credit, wrong scope) still gets skipped in
 * favor of the next one -- see generateHoroscope()/generateJson() below --
 * so one bad key doesn't silently force every caller down to mock while a
 * perfectly good key sits unused.
 */
export function providerOrder(): Provider[] {
  const configured = (process.env.LLM_PROVIDER || "").toLowerCase();
  const preferred = (REAL_PROVIDERS as readonly string[]).includes(configured) && hasKey(configured as RealProvider) ? [configured as RealProvider] : [];
  const rest = REAL_PROVIDERS.filter((p) => hasKey(p) && !preferred.includes(p));
  return [...preferred, ...rest, "mock"];
}

/** Back-compat: the single provider that would be tried first (used only for logging/display). */
export function resolveProvider(): Provider {
  return providerOrder()[0];
}

async function callProvider(provider: RealProvider, prompt: string): Promise<HoroscopeSections> {
  if (provider === "anthropic") return (await import("./anthropicProvider")).generateWithAnthropic(prompt);
  if (provider === "openai") return (await import("./openaiProvider")).generateWithOpenAI(prompt);
  return (await import("./geminiProvider")).generateWithGemini(prompt);
}

export async function generateHoroscope(
  astrology: StructuredAstrologyData,
  opts: { name?: string | null; language: Language }
): Promise<{ sections: HoroscopeSections; provider: Provider }> {
  const prompt = buildHoroscopePrompt(astrology, opts);

  for (const provider of providerOrder()) {
    if (provider === "mock") {
      console.info("[llm] MOCK mode -- no working LLM provider, using template generator");
      return { sections: generateMockHoroscope(astrology, opts.name), provider };
    }
    try {
      return { sections: await callProvider(provider, prompt), provider };
    } catch (err) {
      console.error(`[llm] ${provider} generation failed, trying next provider:`, err instanceof Error ? err.message : err);
    }
  }
  // providerOrder() always ends in "mock", which never throws -- unreachable.
  return { sections: generateMockHoroscope(astrology, opts.name), provider: "mock" };
}

async function callProviderJson(provider: RealProvider, prompt: string): Promise<unknown> {
  if (provider === "anthropic") return (await import("./anthropicProvider")).generateJsonWithAnthropic(prompt);
  if (provider === "openai") return (await import("./openaiProvider")).generateJsonWithOpenAI(prompt);
  return (await import("./geminiProvider")).generateJsonWithGemini(prompt);
}

/**
 * One prompt in, one parsed JSON value out, trying every configured
 * provider in order -- or null if none of them work (or none are
 * configured). Used by dailyReading.ts's rashifal summary and
 * panchangInsight.ts's Panchang interpretation; each caller applies its
 * own fallback (keyword matching, or simply omitting that signal) on null.
 */
export async function generateJson(prompt: string): Promise<unknown | null> {
  for (const provider of providerOrder()) {
    if (provider === "mock") return null;
    try {
      return await callProviderJson(provider, prompt);
    } catch (err) {
      console.warn(`[llm] ${provider} JSON call failed, trying next provider:`, err instanceof Error ? err.message : err);
    }
  }
  return null;
}
