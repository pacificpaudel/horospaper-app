import { Language } from "@/types/enums";
import { StructuredAstrologyData } from "@/lib/astrology";

const LANGUAGE_NAMES: Record<Language, string> = {
  EN: "English",
  NE: "Nepali",
  FI: "Finnish",
};

export function buildHoroscopePrompt(
  astrology: StructuredAstrologyData,
  opts: { name?: string | null; language: Language }
): string {
  const { today, transits, sunSign, moonSign, ascendantSign, system } = astrology;

  const transitLines = transits.length
    ? transits
        .map((t) => `- ${t.description} (${t.nature}, orb ${t.orb}°)`)
        .join("\n")
    : "- No major transits within orb today; focus on the Sun and Moon placements below.";

  return `You are an expert, warm-toned astrologer writing a short personal daily horoscope.
Use ONLY the structured astrology data below -- never invent or recalculate planetary
positions yourself. Do not present astrology as scientifically proven; frame it as
entertainment and personal reflection.

ASTROLOGY SYSTEM: ${system}
PERSON: ${opts.name || "the user"}
NATAL SUN SIGN: ${sunSign}
NATAL MOON SIGN: ${moonSign}
NATAL ASCENDANT: ${ascendantSign ?? "unknown (birth time/location incomplete)"}

TODAY (${today.sunSign} season):
- Today's Sun sign: ${today.sunSign}
- Today's Moon sign: ${today.moonSign}
- Moon phase: ${today.moonPhaseName} (${Math.round(today.moonIllumination * 100)}% illuminated)
- Retrograde planets: ${today.retrogradePlanets.length ? today.retrogradePlanets.join(", ") : "none"}

RELEVANT TRANSITS TO NATAL CHART TODAY:
${transitLines}

Write the horoscope in ${LANGUAGE_NAMES[opts.language]}.

Respond with ONLY a JSON object (no markdown fences, no commentary) with these exact keys,
each a string, using a warm and personal tone, avoiding deterministic claims like
"you will definitely...". Prefer phrasing like "today favors...", "you might notice...",
"this is a good day to...", "pay attention to...". Keep the combined total length of
overall+love+career+money+energy between 150 and 250 words:

{
  "overall": "daily overall reading",
  "love": "love and relationships",
  "career": "career and work",
  "money": "money",
  "energy": "energy and wellbeing",
  "luckyTheme": "a short lucky theme, a few words",
  "focus": "a suggested focus for the day, one or two sentences",
  "motivation": "a short motivational closing message, one sentence"
}`;
}
