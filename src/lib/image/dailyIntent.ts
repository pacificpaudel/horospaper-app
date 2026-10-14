// The day's 2 tags: a mood (how the day feels, from the combined luck
// reading) and a theme (what it's about, from the day's rashifal or the
// Moon's transit house). Both come from fixed vocabularies, and each has
// literal, photographable scenes (dailyScenes below) the wallpaper photo is
// chosen from -- abstract phrases ("vitality green nature") returned
// photos that didn't show the day at all.

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

/**
 * A concrete, photographable picture of a day: what to search for, the
 * words a matching photo's title or tags must contain (so a "monks
 * meditation" search can't hand back a sea monster), and how to describe
 * it to an image generator.
 */
export interface DailyScene {
  query: string;
  match: string[];
  describe: string;
}

const scene = (query: string, match: string[], describe: string): DailyScene => ({ query, match, describe });

// What each theme looks like -- literal scenes, not abstractions, so the
// wallpaper shows the day plainly (career: an office; patience: monks in
// meditation). Several per theme, so the picture varies from day to day.
const THEME_SCENES: Record<ThemeTag, DailyScene[]> = {
  career: [
    scene("modern office workspace", ["office", "workspace", "desk", "coworking", "workplace"], "a bright, professional modern office workspace"),
    scene("business meeting office", ["meeting", "business", "office", "conference"], "a professional team meeting in a modern office"),
    scene("business district skyscrapers", ["skyscraper", "skyline", "business district", "financial district", "downtown"], "a city business district with glass skyscrapers"),
  ],
  enterprise: [
    scene("busy market stalls", ["market", "bazaar", "stall", "vendor"], "a lively market with busy trading stalls"),
    scene("shop storefront", ["shop", "store", "storefront", "boutique"], "an inviting small shop storefront"),
  ],
  prosperity: [
    scene("golden wheat harvest field", ["wheat", "harvest", "grain", "hay"], "a golden wheat field at harvest"),
    scene("rice terraces", ["rice", "terrace", "paddy"], "lush green rice terraces"),
    scene("gold coins", ["coin", "gold"], "a pile of gold coins"),
  ],
  connection: [
    scene("couple holding hands", ["couple", "holding hands", "romance", "love"], "a loving couple holding hands"),
    scene("couple sunset", ["couple", "romance", "love"], "a couple together at sunset"),
  ],
  friendship: [
    scene("friends laughing together", ["friends", "friendship", "laughing", "laughter"], "a group of friends laughing together"),
    scene("group of friends", ["friends", "friendship"], "close friends spending time together"),
  ],
  family: [
    scene("family dinner together", ["family", "dinner", "parents", "grandparents"], "a family sharing dinner together at home"),
    scene("family walking together", ["family", "parents", "mother", "father", "children"], "a family walking together outdoors"),
    scene("parents and children", ["family", "parents", "mother", "father", "children", "kids"], "parents and children together"),
  ],
  creativity: [
    scene("artist painting canvas", ["artist", "painting", "painter", "canvas", "easel", "studio"], "an artist painting on a canvas in a studio"),
    scene("pottery wheel", ["pottery", "potter", "clay", "ceramic"], "hands shaping clay on a pottery wheel"),
  ],
  learning: [
    scene("library bookshelves", ["library", "bookshelf", "bookshelves", "books"], "a quiet library with tall bookshelves"),
    scene("student studying books", ["study", "studying", "student", "books", "reading"], "a student studying with books"),
  ],
  journey: [
    scene("open road landscape", ["road", "highway", "route"], "an open road stretching through a wide landscape"),
    scene("train journey railway", ["train", "railway", "railroad"], "a train travelling through scenic country"),
  ],
  courage: [
    scene("mountain climber summit", ["climber", "climbing", "summit", "mountaineer", "mountaineering"], "a mountain climber reaching the summit"),
    scene("rock climbing", ["climber", "climbing", "bouldering"], "a rock climber on a steep cliff face"),
  ],
  vitality: [
    scene("morning runners", ["runner", "running", "jogging", "marathon"], "a runner out in the fresh morning light"),
    scene("yoga sunrise", ["yoga", "stretching", "fitness"], "yoga practice at sunrise"),
    scene("fresh fruit vegetables", ["fruit", "vegetables", "produce"], "colourful fresh fruit and vegetables"),
  ],
  rest: [
    scene("hammock relax", ["hammock", "relax", "relaxing", "rest"], "a hammock in a peaceful, shady spot"),
    scene("cup of tea window", ["tea", "cup", "mug"], "a calm cup of tea by a sunny window"),
  ],
  devotion: [
    scene("hindu temple", ["temple", "mandir", "shrine"], "a beautiful Hindu temple in soft light"),
    scene("diya oil lamps", ["diya", "oil lamp", "lamps", "diwali"], "glowing diya oil lamps"),
    scene("prayer candles", ["prayer", "candles", "praying"], "rows of lit prayer candles"),
  ],
  patience: [
    scene("monks meditation", ["monk", "meditation", "meditating"], "Buddhist monks sitting in calm meditation"),
    scene("buddhist monks", ["monk", "monks"], "Buddhist monks in quiet contemplation"),
    scene("meditation", ["meditation", "meditating", "zen"], "a person meditating in stillness"),
  ],
  transformation: [
    scene("butterfly", ["butterfly"], "a butterfly with open wings"),
    scene("butterfly chrysalis", ["chrysalis", "caterpillar", "butterfly"], "a butterfly emerging from its chrysalis"),
  ],
};

// Moods strong enough to lead the picture over the theme: a day to be
// careful shows a red traffic light, whatever it's about.
const MOOD_SCENES: Partial<Record<MoodTag, DailyScene[]>> = {
  cautious: [
    scene("red traffic light", ["traffic light", "traffic signal", "stoplight", "traffic lights", "red light"], "a red traffic light glowing at a crossing"),
    scene("traffic lights night", ["traffic light", "traffic signal", "stoplight", "traffic lights"], "traffic lights glowing red at night"),
  ],
  restless: [
    scene("stormy sea waves", ["storm", "stormy", "waves"], "stormy sea with crashing waves"),
    scene("lightning storm", ["lightning", "thunderstorm", "storm"], "lightning across a stormy sky"),
  ],
};

/** Shown only if every scene above comes back empty. */
const FALLBACK_SCENE = scene("sunrise landscape", ["sunrise", "sunset", "landscape"], "a calm landscape at sunrise");

/**
 * The day's scenes, best first: a leading mood's (see MOOD_SCENES), then
 * the theme's -- each list rotated by `pick` so consecutive days differ --
 * and a broad fallback last.
 */
export function dailyScenes(intent: DailyIntent, pick: number): DailyScene[] {
  const rotate = (list: DailyScene[]) => list.map((_, k) => list[(pick + k) % list.length]);
  return [...rotate(MOOD_SCENES[intent.mood] ?? []), ...rotate(THEME_SCENES[intent.theme]), FALLBACK_SCENE];
}
