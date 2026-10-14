import { dailyScenes, DailyIntent, DailyScene } from "./dailyIntent";

const OPENVERSE_API = "https://api.openverse.org/v1/images/";
const REQUEST_TIMEOUT_MS = 15000;

interface OpenverseResult {
  id: string;
  url: string;
  title?: string;
  license?: string;
  creator?: string;
  attribution?: string;
  width?: number;
  height?: number;
  tags?: { name?: string }[];
}

interface OpenverseResponse {
  results?: OpenverseResult[];
}

function hash(input: string): number {
  let value = 0;
  for (const character of input) value = (Math.imul(31, value) + character.charCodeAt(0)) | 0;
  return Math.abs(value);
}

// Photos whose title or tags say they're not the real thing: toys,
// drawings, street art, quote cards, screenshots, abstracts, AI pictures.
const NOT_A_PHOTO = [
  "lego", "toy", "figurine", "cartoon", "drawing", "sketch", "illustration", "mural", "graffiti", "streetart", "quote", "meme",
  "screenshot", "poster", "logo", "diagram", "map", "comic", "statue", "sculpture", "postcard", "rppc", "museum", "exhibit", "bubble mart",
  "stained glass", "abstract", "long exposure", "dall·e", "dall-e", "midjourney", "stable diffusion", "ai generated", "ai art",
];
// Big enough to be cropped to a 1080x1920 or 1920x1080 wallpaper without going soft.
const MIN_SIDE = 600;
const GOOD_SIDE = 900;
/** More tags than this and a photo's tags say little about what it shows. */
const MAX_TRUSTED_TAGS = 25;
/** A scene with at least this many matching photos is used; fewer, and the next scene is tried. */
const MIN_POOL = 3;

/**
 * Whether a result really shows the scene: its title names it, or at least
 * two of the scene's words are among its tags (one tag alone is too loose
 * -- a church painting is tagged "painting" too) -- and nothing in either
 * says it's a toy, a drawing or a museum piece.
 */
function shows(result: OpenverseResult, scene: DailyScene): boolean {
  const title = (result.title ?? "").toLowerCase();
  const tags = (result.tags ?? []).map((tag) => (tag.name ?? "").toLowerCase()).join(" ");
  if (NOT_A_PHOTO.some((word) => title.includes(word) || tags.includes(word))) return false;
  if (scene.match.some((word) => title.includes(word))) return true;
  // Some uploaders tag every photo with dozens of loose words; for those,
  // only the title counts.
  return (result.tags ?? []).length <= MAX_TRUSTED_TAGS && scene.match.filter((word) => tags.includes(word)).length >= 2;
}

export async function generateOpenverseImage(params: {
  stableSeed: string;
  intent: DailyIntent;
  /**
   * True for an explicit user-requested regeneration. Fetching a randomized
   * page instead of always page 1 draws from a larger effective pool, and
   * picking the final image with real randomness (rather than
   * hash(stableSeed), which is deterministic given the same inputs) removes
   * any chance of two regenerations landing on the same photo by design.
   */
  randomize?: boolean;
}): Promise<{ buffer: Buffer; contentType: string; extension: string; prompt: string }> {
  // The day's scenes, best first (a leading mood's, then the theme's, then a
  // broad fallback -- see dailyScenes). Each is a literal, photographable
  // subject, and only photos whose title or tags actually name it are
  // kept, so the wallpaper shows what the day is about.
  const seed = hash(params.stableSeed);
  const scenes = dailyScenes(params.intent, params.randomize ? Math.floor(Math.random() * 1000) : seed);
  const page = params.randomize ? 1 + Math.floor(Math.random() * 3) : 1;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  async function search(scene: DailyScene, pageNumber: number): Promise<OpenverseResult[]> {
    const requestUrl = new URL(OPENVERSE_API);
    requestUrl.searchParams.set("q", scene.query);
    requestUrl.searchParams.set("page_size", "20");
    requestUrl.searchParams.set("page", String(pageNumber));
    requestUrl.searchParams.set("mature", "false");
    requestUrl.searchParams.set("category", "photograph");
    const response = await fetch(requestUrl, {
      headers: { Accept: "application/json", "User-Agent": "horospaper/1.0" },
      signal: controller.signal,
    });
    // A page past the end of a small pool is a 400/404, not a failure of the search.
    if (!response.ok) return [];
    const payload = (await response.json()) as OpenverseResponse;
    return (payload.results ?? []).filter(
      (result) => result.url && result.width && result.height && Math.min(result.width, result.height) >= MIN_SIDE && shows(result, scene)
    );
  }

  try {
    let chosen: { scene: DailyScene; pool: OpenverseResult[] } | null = null;
    for (const scene of scenes) {
      let pool = await search(scene, page);
      // A randomized page can come back short -- page 1 always has the most.
      if (pool.length < MIN_POOL && page > 1) pool = await search(scene, 1);
      if (pool.length && (!chosen || pool.length > chosen.pool.length)) chosen = { scene, pool };
      if (pool.length >= MIN_POOL) break;
    }
    if (!chosen) throw new Error("Openverse returned no matching photos");

    // Sharper photos first, when there are enough of them to choose from.
    const sharp = chosen.pool.filter((result) => Math.min(result.width!, result.height!) >= GOOD_SIDE);
    const pool = sharp.length >= MIN_POOL ? sharp : chosen.pool;
    const selected = pool[params.randomize ? Math.floor(Math.random() * pool.length) : seed % pool.length];
    const imageResponse = await fetch(selected.url, {
      headers: { "User-Agent": "horospaper/1.0" },
      signal: controller.signal,
    });
    if (!imageResponse.ok) throw new Error(`Openverse image download failed (${imageResponse.status})`);
    const contentType = imageResponse.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!contentType.startsWith("image/")) throw new Error("Openverse result was not an image");
    const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const attribution = selected.attribution || `${selected.title || "Openverse image"} by ${selected.creator || "unknown creator"}`;
    return { buffer, contentType, extension, prompt: `Openverse daily scene: ${chosen.scene.query}. ${attribution}` };
  } finally {
    clearTimeout(timeout);
  }
}
