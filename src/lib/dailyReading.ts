import { z } from "zod";
import { redis } from "@/lib/redis";
import { StructuredAstrologyData } from "@/lib/astrology";
import { computeGochar, GocharReading } from "@/lib/astrology/gochar";
import { rashiForMoon } from "@/lib/astrology/rashi";
import { dateOnlyString } from "@/lib/astrology/dailyData";
import { getDailyRashifal } from "@/lib/rashifal";
import { adToBs } from "@/lib/nepaliDate";
import { resolveProvider } from "@/lib/llm/generateHoroscope";
import { DailyIntent, isThemeTag, MoodTag, THEME_TAGS, ThemeTag } from "@/lib/image/dailyIntent";
import type { KundliData } from "@/lib/astrologyApi";

/**
 * Everything the wallpaper needs about "today" for one person: the luck
 * percentage and the day's 2 tags, plus how they were arrived at. Stored
 * on the Horoscope so the client, the overlays and the image search all
 * read the same numbers instead of each re-deriving them.
 */
export interface DailyReading {
  rashi: { name: string; nepali: string; sign: string };
  luckScore: number;
  intent: DailyIntent;
  planetary: GocharReading;
  /** The birth chart drawn above the luck meter (attached in horoscope.ts). */
  kundli?: KundliData | null;
  rashifal: {
    bsDate: string;
    source: "hamropatro";
    /** -1 (very unfavorable) .. 1 (very favorable). */
    sentiment: number;
    theme: ThemeTag;
    summary: string | null;
    method: "llm" | "keywords";
  } | null;
}

// --- Rashifal summarization ------------------------------------------------

interface RashifalSummary {
  sentiment: number;
  theme: ThemeTag;
  summary: string | null;
  method: "llm" | "keywords";
}

// Stems, matched as substrings of the Nepali text. "असफल" contains "सफल",
// so it's listed twice under negative to cancel that positive hit.
const POSITIVE_STEMS = [
  "लाभ", "सफल", "राम्रो", "सहज", "प्रगति", "उन्नति", "सम्मान", "खुसी", "खुशी", "प्रसन्न", "अवसर", "फाइदा",
  "सहयोग", "विजय", "प्रशंसा", "प्रतिष्ठा", "आनन्द", "सुखद", "अनुकूल", "उत्साह", "आम्दानी",
];
const NEGATIVE_STEMS = [
  "हानि", "नोक्सान", "विवाद", "झगडा", "कष्ट", "तनाव", "चिन्ता", "खर्च", "बाधा", "अवरोध", "रोग", "थकान",
  "असफल", "असफल", "सतर्क", "सावधान", "ढिला", "गुमाउ", "अपमान", "दुःख", "दु:ख", "निराश", "कठिन", "समस्या",
  "चोट", "धोका", "प्रतिकूल", "आलस्य", "अल्छी", "बिग्र",
];

const THEME_STEMS: Record<ThemeTag, string[]> = {
  prosperity: ["धन", "आम्दानी", "आय", "पैसा", "आर्थिक", "लगानी", "कमाइ", "सम्पत्ति"],
  enterprise: ["व्यापार", "कारोबार", "लेनदेन", "व्यवसाय", "सौदा"],
  career: ["जागिर", "कार्यालय", "नोकरी", "पेशा", "कामकाज", "कार्यक्षेत्र"],
  connection: ["प्रेम", "सम्बन्ध", "दाम्पत्य", "जीवनसाथी", "प्रेमी"],
  friendship: ["मित्र", "साथी", "सामाजिक"],
  family: ["परिवार", "आमा", "बुबा", "सन्तान", "छोराछोरी", "आफन्त"],
  creativity: ["कला", "रचनात्मक", "सिर्जना", "मनोरञ्जन", "संगीत"],
  learning: ["अध्ययन", "शिक्षा", "विद्यार्थी", "ज्ञान", "पढाइ", "परीक्षा"],
  journey: ["यात्रा", "भ्रमण", "विदेश"],
  courage: ["साहस", "आँट", "पराक्रम", "प्रतिस्पर्धा"],
  vitality: ["स्वास्थ्य", "शरीर", "ऊर्जा", "जोश"],
  rest: ["आराम", "थकान", "विश्राम"],
  devotion: ["धार्मिक", "आध्यात्मिक", "पूजा", "तीर्थ"],
  patience: ["धैर्य", "संयम", "सावधान", "सतर्क"],
  transformation: ["परिवर्तन", "नयाँ सुरुवात", "बदलाव"],
};

// The Moon's transit house from the natal Moon, when there's no rashifal.
const HOUSE_THEME_TAGS: Record<number, ThemeTag> = {
  1: "vitality",
  2: "prosperity",
  3: "courage",
  4: "family",
  5: "creativity",
  6: "career",
  7: "connection",
  8: "transformation",
  9: "journey",
  10: "career",
  11: "friendship",
  12: "rest",
};

/** Drops the boilerplate "today's lucky colour/number" sentence. */
function readingBody(text: string): string {
  return text
    .split("।")
    .filter((sentence) => !sentence.includes("शुभ रंग") && !sentence.includes("शुभ अंक"))
    .join("।");
}

function countStems(text: string, stems: string[]): number {
  return stems.reduce((count, stem) => count + text.split(stem).length - 1, 0);
}

export function summarizeWithKeywords(text: string, fallbackTheme: ThemeTag): RashifalSummary {
  const body = readingBody(text);
  const positive = countStems(body, POSITIVE_STEMS);
  const negative = countStems(body, NEGATIVE_STEMS);
  const sentiment = (positive - negative) / (positive + negative + 2);

  let theme = fallbackTheme;
  let best = 0;
  for (const [tag, stems] of Object.entries(THEME_STEMS) as [ThemeTag, string[]][]) {
    const hits = countStems(body, stems);
    if (hits > best) {
      best = hits;
      theme = tag;
    }
  }
  return { sentiment: Math.round(sentiment * 100) / 100, theme, summary: null, method: "keywords" };
}

const LlmSummarySchema = z.object({
  sentiment: z.number().min(-1).max(1),
  theme: z.string().refine(isThemeTag),
  summary: z.string().max(300),
});

function buildSummaryPrompt(text: string, rashiName: string): string {
  return `Below is today's Nepali daily rashifal (horoscope) for the ${rashiName} rashi.

<rashifal>
${text}
</rashifal>

Summarize it as JSON with exactly these keys:
- "sentiment": a number from -1 (a clearly unfavorable, difficult day) to 1 (a clearly favorable, lucky day). Judge only what the text says; ignore the closing lucky colour/number line.
- "theme": the single life area the reading is mostly about, chosen from exactly this list: ${Object.keys(THEME_TAGS).join(", ")}.
- "summary": one short English sentence summarizing the reading.

Respond with ONLY the JSON object.`;
}

async function summarizeWithLlm(text: string, rashiName: string): Promise<RashifalSummary | null> {
  const provider = resolveProvider();
  if (provider === "mock") return null;
  try {
    const prompt = buildSummaryPrompt(text, rashiName);
    const raw =
      provider === "anthropic"
        ? await (await import("@/lib/llm/anthropicProvider")).generateJsonWithAnthropic(prompt)
        : await (await import("@/lib/llm/openaiProvider")).generateJsonWithOpenAI(prompt);
    const parsed = LlmSummarySchema.parse(raw);
    return {
      sentiment: Math.round(parsed.sentiment * 100) / 100,
      theme: parsed.theme as ThemeTag,
      summary: parsed.summary,
      method: "llm",
    };
  } catch (err) {
    console.warn("[dailyReading] LLM rashifal summary failed, using keywords:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * One summary per (BS date, rashi): everyone sharing a rashi reads the same
 * rashifal, so it's summarized once and every regeneration that day gets
 * the same sentiment/theme rather than a fresh LLM roll.
 */
async function summarizeRashifal(text: string, bsDate: string, slug: string, rashiName: string, fallbackTheme: ThemeTag): Promise<RashifalSummary> {
  const key = `rashifal-summary:${bsDate}:${slug}`;
  const cached = await redis.get<RashifalSummary>(key).catch(() => null);
  if (cached) return cached;
  const summary = (await summarizeWithLlm(text, rashiName)) ?? summarizeWithKeywords(text, fallbackTheme);
  await redis.set(key, summary, { ex: 36 * 60 * 60 }).catch(() => {});
  return summary;
}

// --- Combination -------------------------------------------------------------

export function moodFor(luck: number, rashifalSentiment: number | null, planetary: GocharReading): MoodTag {
  if (planetary.chandrashtama && luck < 45) return "restless";
  if (luck >= 84) return "radiant";
  if (luck >= 72) return (rashifalSentiment ?? 0) >= 0.3 ? "joyful" : "hopeful";
  if (luck >= 60) return planetary.tara.score > 0 ? "serene" : "hopeful";
  if (luck >= 50) return "steady";
  if (luck >= 40) return "determined";
  if (luck >= 30) return "cautious";
  return "reflective";
}

/** Planets 60% (computed for this person's own chart), shared per-rashi rashifal 40%. */
export function combineLuck(planetaryScore: number, rashifalSentiment: number | null): number {
  const combined = rashifalSentiment === null ? planetaryScore : planetaryScore * 0.6 + rashifalSentiment * 0.4;
  return Math.max(5, Math.min(97, Math.round(50 + combined * 45)));
}

/**
 * Builds the day's reading for a natal chart. `forDate` is the user's own
 * local calendar day (anchored to noon UTC, see todayForTimezone), used
 * both for the transit positions and to pick the matching BS-dated
 * rashifal.
 */
export async function buildDailyReading(astrology: StructuredAstrologyData, forDate: Date): Promise<DailyReading> {
  // The natal chart is sidereal (Lahiri) for the Vedic system, which is the
  // only one the app offers -- exactly what the rashi and gochar need.
  const natalMoon = astrology.natalChart.planets.moon.longitude;
  const rashi = rashiForMoon(natalMoon);
  const planetary = computeGochar(natalMoon, forDate);
  const houseTheme = HOUSE_THEME_TAGS[planetary.moonHouse];

  const bsDate = adToBs(dateOnlyString(forDate));
  const rashifalText = bsDate ? await getDailyRashifal(rashi, bsDate) : null;
  const summary = rashifalText
    ? await summarizeRashifal(rashifalText.text, rashifalText.bsDate, rashi.slug, rashi.name, houseTheme)
    : null;

  const luckScore = combineLuck(planetary.score, summary?.sentiment ?? null);

  return {
    rashi: { name: rashi.name, nepali: rashi.nepali, sign: rashi.sign },
    luckScore,
    intent: {
      mood: moodFor(luckScore, summary?.sentiment ?? null, planetary),
      theme: summary?.theme ?? houseTheme,
    },
    planetary,
    rashifal:
      rashifalText && summary
        ? { bsDate: rashifalText.bsDate, source: rashifalText.source, ...summary }
        : null,
  };
}
