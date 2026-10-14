import { dailyScenes, DailyIntent, DailyScene } from "./dailyIntent";

// The day's wallpaper photo from Pexels (pexels.com): a curated library of
// professional photos, each with a written description -- so a "modern
// office workspace" search returns a real, good-looking office, and the
// description confirms it shows the scene. Used ahead of Openverse when
// PEXELS_API_KEY is set (a free key from pexels.com/api).

const PEXELS_API = "https://api.pexels.com/v1/search";
const REQUEST_TIMEOUT_MS = 15000;
/** A scene with fewer matching photos than this falls through to the next. */
const MIN_POOL = 3;
// Wide enough for a 1920-wide desktop wallpaper, small enough to download fast.
const DOWNLOAD_WIDTH = 2400;

interface PexelsPhoto {
  width: number;
  height: number;
  url: string;
  photographer: string;
  alt?: string;
  src: { original: string };
}

interface PexelsResponse {
  photos?: PexelsPhoto[];
}

function hash(input: string): number {
  let value = 0;
  for (const character of input) value = (Math.imul(31, value) + character.charCodeAt(0)) | 0;
  return Math.abs(value);
}

/** Whether a photo's description names the scene. */
const shows = (photo: PexelsPhoto, scene: DailyScene) => scene.match.some((word) => (photo.alt ?? "").toLowerCase().includes(word));

export async function generatePexelsImage(params: {
  apiKey: string;
  stableSeed: string;
  intent: DailyIntent;
  /** True for an explicit user-requested regeneration: a random pick (and page) instead of the day's fixed one. */
  randomize?: boolean;
}): Promise<{ buffer: Buffer; contentType: string; extension: string; prompt: string }> {
  const seed = hash(params.stableSeed);
  const scenes = dailyScenes(params.intent, params.randomize ? Math.floor(Math.random() * 1000) : seed);
  const page = params.randomize ? 1 + Math.floor(Math.random() * 3) : 1;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  async function search(scene: DailyScene, pageNumber: number): Promise<PexelsPhoto[]> {
    const requestUrl = new URL(PEXELS_API);
    requestUrl.searchParams.set("query", scene.query);
    requestUrl.searchParams.set("per_page", "30");
    requestUrl.searchParams.set("page", String(pageNumber));
    requestUrl.searchParams.set("size", "large");
    const response = await fetch(requestUrl, { headers: { Authorization: params.apiKey }, signal: controller.signal });
    if (!response.ok) throw new Error(`Pexels search failed (${response.status})`);
    const payload = (await response.json()) as PexelsResponse;
    return (payload.photos ?? []).filter((photo) => photo.src?.original && shows(photo, scene));
  }

  try {
    let chosen: { scene: DailyScene; pool: PexelsPhoto[] } | null = null;
    for (const scene of scenes) {
      let pool = await search(scene, page);
      if (pool.length < MIN_POOL && page > 1) pool = await search(scene, 1);
      if (pool.length && (!chosen || pool.length > chosen.pool.length)) chosen = { scene, pool };
      if (pool.length >= MIN_POOL) break;
    }
    if (!chosen) throw new Error("Pexels returned no matching photos");

    const selected = chosen.pool[params.randomize ? Math.floor(Math.random() * chosen.pool.length) : seed % chosen.pool.length];
    const imageUrl = `${selected.src.original}?auto=compress&cs=tinysrgb&w=${DOWNLOAD_WIDTH}`;
    const imageResponse = await fetch(imageUrl, { signal: controller.signal });
    if (!imageResponse.ok) throw new Error(`Pexels image download failed (${imageResponse.status})`);
    const contentType = imageResponse.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!contentType.startsWith("image/")) throw new Error("Pexels result was not an image");
    const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    return { buffer, contentType, extension, prompt: `Pexels daily scene: ${chosen.scene.query}. Photo by ${selected.photographer} on Pexels (${selected.url})` };
  } finally {
    clearTimeout(timeout);
  }
}
