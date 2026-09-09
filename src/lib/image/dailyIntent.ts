import { StructuredAstrologyData } from "@/lib/astrology";
import { calculateLuckScore } from "@/lib/luckScore";

export interface DailyIntent {
  keywords: [string, string, string, string];
  mood: "joyful" | "reflective" | "tender" | "resilient";
}

export function deriveDailyIntent(astrology: StructuredAstrologyData): DailyIntent {
  const luck = calculateLuckScore(astrology);
  const harmonious = astrology.transits.filter((transit) => transit.nature === "harmonious").length;
  const challenging = astrology.transits.filter((transit) => transit.nature === "challenging").length;
  const mood = luck >= 72 ? "joyful" : luck >= 52 ? "reflective" : luck >= 34 ? "tender" : "resilient";
  const light = astrology.today.moonIllumination >= 0.65 ? "sunlit" : astrology.today.moonIllumination >= 0.35 ? "soft light" : "twilight";
  const movement = harmonious > challenging ? "open movement" : challenging > harmonious ? "quiet pause" : "stillness";
  const reflection = `${astrology.today.moonPhaseName.toLowerCase()} reflection`;

  return {
    keywords: [mood, light, movement, reflection],
    mood,
  };
}

export function dailyIntentQuery(intent: DailyIntent): string {
  return `${intent.keywords.join(" ")} human emotion reflection fine art mixed media`;
}
