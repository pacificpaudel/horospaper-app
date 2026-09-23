import { z } from "zod";
import { redis } from "@/lib/redis";
import { PanchangData } from "@/lib/panchang";
import { resolveProvider } from "@/lib/llm/generateHoroscope";
import { ThemeTag, THEME_TAGS, isThemeTag } from "@/lib/image/dailyIntent";

// Stage 2 of the Panchang pipeline: an LLM interprets the *exact* Panchang
// values fetched in panchang.ts -- it never calculates or guesses tithi,
// nakshatra, yoga, or karana itself, only explains what they traditionally
// mean. Cached per (date, location): one interpretation is shared by every
// user at that place on that day.

export interface PanchangInsight {
  /** -1 (traditionally difficult day) .. 1 (traditionally very favorable). */
  sentiment: number;
  theme: ThemeTag;
  summary: string;
  suitableActivities: string[];
  avoidedActivities: string[];
}

const InsightSchema = z.object({
  sentiment: z.number().min(-1).max(1),
  theme: z.string().refine(isThemeTag),
  summary: z.string().max(300),
  suitable_activities: z.array(z.string().max(60)).max(6),
  avoided_activities: z.array(z.string().max(60)).max(6),
});

function buildPrompt(panchang: PanchangData): string {
  return `You are a traditional Hindu Panchang interpreter. Below are today's exact Panchang values, already calculated -- use ONLY these values; never calculate or guess a tithi, nakshatra, yoga, or karana yourself.

<panchang>
Weekday (vara): ${panchang.weekday}
Tithi: ${panchang.tithi.name} (${panchang.tithi.paksha} paksha)
Nakshatra: ${panchang.nakshatra.name}, pada ${panchang.nakshatra.pada}, lord ${panchang.nakshatra.lord}
Yoga: ${panchang.yoga.name}
Karana: ${panchang.karana.name}
${panchang.rahuKalam ? `Rahu Kalam: ${panchang.rahuKalam.start}-${panchang.rahuKalam.end}` : ""}
${panchang.moonSign ? `Moon sign: ${panchang.moonSign}` : ""}
</panchang>

Using traditional Jyotish/Panchang concepts, interpret this combination as JSON with exactly these keys:
- "sentiment": a number from -1 (traditionally a difficult, obstacle-prone day) to 1 (traditionally a very favorable day), based on the tithi/nakshatra/yoga combination above.
- "theme": the single life area this day's Panchang traditionally favors, chosen from exactly this list: ${Object.keys(THEME_TAGS).join(", ")}.
- "summary": one short, plain-English sentence on the day's overall character. Present this as traditional belief, not scientific fact; make no medical or financial claims.
- "suitable_activities": up to 4 short traditionally suitable activities for this Panchang combination.
- "avoided_activities": up to 3 short traditionally avoided activities (e.g. during Rahu Kalam, or for this tithi/yoga).

Respond with ONLY the JSON object.`;
}

async function interpretWithLlm(panchang: PanchangData): Promise<PanchangInsight | null> {
  const provider = resolveProvider();
  if (provider === "mock") return null;
  try {
    const prompt = buildPrompt(panchang);
    const raw =
      provider === "anthropic"
        ? await (await import("@/lib/llm/anthropicProvider")).generateJsonWithAnthropic(prompt)
        : await (await import("@/lib/llm/openaiProvider")).generateJsonWithOpenAI(prompt);
    const parsed = InsightSchema.parse(raw);
    return {
      sentiment: Math.round(parsed.sentiment * 100) / 100,
      theme: parsed.theme as ThemeTag,
      summary: parsed.summary,
      suitableActivities: parsed.suitable_activities,
      avoidedActivities: parsed.avoided_activities,
    };
  } catch (err) {
    console.warn("[panchangInsight] LLM interpretation failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * The day's Panchang insight for one location, or null if no Panchang data
 * or no LLM is available. One interpretation per (date, location) is
 * shared by every user there -- cheap even at scale, unlike a per-person
 * call. `key` should already be rounded/hashed the way panchang.ts's
 * cacheKey does it, so the same day+place always hits the same entry.
 */
export async function getPanchangInsight(panchang: PanchangData, cacheKey: string): Promise<PanchangInsight | null> {
  const key = `panchang-insight:v1:${cacheKey}`;
  const cached = await redis.get<PanchangInsight>(key).catch(() => null);
  if (cached) return cached;

  const insight = await interpretWithLlm(panchang);
  if (insight) await redis.set(key, insight, { ex: 36 * 60 * 60 }).catch(() => {});
  return insight;
}
