// The day's 2 tags: a mood (how the day feels, from the combined luck
// reading) and a theme (what it's about, from the day's rashifal or the
// Moon's transit house). Both come from fixed vocabularies so every tag
// has a hand-picked, visually searchable Openverse phrase -- free-form
// words (or the old always-"joyful sunlit" pair) tend to return tiny or
// off-theme image pools.

export const MOOD_TAGS = {
  radiant: "radiant golden light",
  joyful: "joyful celebration colors",
  hopeful: "hopeful sunrise",
  serene: "serene calm lake",
  steady: "mountain landscape calm",
  determined: "determined climber summit",
  cautious: "misty forest path",
  reflective: "quiet reflection water",
  restless: "stormy sea waves",
} as const;

export const THEME_TAGS = {
  prosperity: "golden harvest abundance",
  enterprise: "busy market trade",
  career: "city skyline ambition",
  connection: "love togetherness",
  friendship: "friends laughter",
  family: "family home warmth",
  creativity: "colorful painting creativity",
  learning: "books library learning",
  journey: "journey open road",
  courage: "courage brave horse",
  vitality: "vitality green nature",
  rest: "rest peaceful nature",
  devotion: "temple spiritual light",
  patience: "patience still water stones",
  transformation: "butterfly transformation",
} as const;

export type MoodTag = keyof typeof MOOD_TAGS;
export type ThemeTag = keyof typeof THEME_TAGS;

export interface DailyIntent {
  mood: MoodTag;
  theme: ThemeTag;
}

export function isMoodTag(value: unknown): value is MoodTag {
  return typeof value === "string" && value in MOOD_TAGS;
}

export function isThemeTag(value: unknown): value is ThemeTag {
  return typeof value === "string" && value in THEME_TAGS;
}

/** Most specific first; the last entry is a guaranteed-broad fallback. */
export function dailyIntentQueries(intent: DailyIntent): string[] {
  return [
    `${MOOD_TAGS[intent.mood]} ${THEME_TAGS[intent.theme]} art`,
    `${THEME_TAGS[intent.theme]} art`,
    `${intent.mood} art`,
  ];
}
