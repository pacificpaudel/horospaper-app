import { redis, TTL_SECONDS } from "@/lib/redis";
import { dailyScenes, DailyIntent, DailyScene } from "./dailyIntent";

// The day's wallpaper photo from Unsplash (unsplash.com): professional,
// high-resolution photos with strong search ranking and a written
// description of each -- so a "modern office workspace" search returns a
// real, good-looking office. Used ahead of Openverse when UNSPLASH_API_KEY
// (the app's Access Key) is set. Per Unsplash's API guidelines, each used
// photo's download is reported (download_location) and the photographer is
// credited (kept with the wallpaper's prompt).

const UNSPLASH_API = "https://api.unsplash.com";
const REQUEST_TIMEOUT_MS = 15000;
/** A scene with fewer matching photos than this falls through to the next. */
const MIN_POOL = 3;
// Unsplash's own ranking is strong, but its descriptions don't always name
// the subject ("closeup photo of silver iMac" for an office) -- so when too
// few describe it, the scene's top results are trusted instead.
const TRUSTED_TOP = 8;
// Wide enough for a 1920-wide desktop wallpaper and a 1920-tall phone crop.
const DOWNLOAD_WIDTH = 2400;
const NOT_A_PHOTO = ["illustration", "3d render", "rendering", "cartoon", "toy", "figurine", "statue", "drawing"];

interface UnsplashPhoto {
  id: string;
  width: number;
  height: number;
  description: string | null;
  alt_description: string | null;
  /** Set on paid placements, which aren't search results. */
  sponsorship: unknown;
  urls: { raw: string };
  links: { html: string; download_location: string };
  user: { name: string; links: { html: string } };
}

interface UnsplashSearch {
  results?: UnsplashPhoto[];
}

function hash(input: string): number {
  let value = 0;
  for (const character of input) value = (Math.imul(31, value) + character.charCodeAt(0)) | 0;
  return Math.abs(value);
}

const describedAs = (photo: UnsplashPhoto) => `${photo.alt_description ?? ""} ${photo.description ?? ""}`.toLowerCase();

export async function generateUnsplashImage(params: {
  accessKey: string;
  stableSeed: string;
  intent: DailyIntent;
  /** True for an explicit user-requested regeneration: a random pick (and page) instead of the day's fixed one. */
  randomize?: boolean;
}): Promise<{ buffer: Buffer; contentType: string; extension: string; prompt: string }> {
  const seed = hash(params.stableSeed);
  const scenes = dailyScenes(params.intent, params.randomize ? Math.floor(Math.random() * 1000) : seed);
  const page = params.randomize ? 1 + Math.floor(Math.random() * 3) : 1;
  const headers = { Authorization: `Client-ID ${params.accessKey}`, "Accept-Version": "v1" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  /** The scene's real photos (no ads, nothing drawn), best ranked first; cached for the day to spare the hourly rate limit. */
  async function search(scene: DailyScene, pageNumber: number): Promise<UnsplashPhoto[]> {
    const cacheKey = `unsplash:v1:${scene.query}:${pageNumber}`;
    let photos = await redis.get<UnsplashPhoto[]>(cacheKey).catch(() => null);
    if (!photos) {
      const requestUrl = new URL(`${UNSPLASH_API}/search/photos`);
      requestUrl.searchParams.set("query", scene.query);
      requestUrl.searchParams.set("per_page", "30");
      requestUrl.searchParams.set("page", String(pageNumber));
      requestUrl.searchParams.set("content_filter", "high");
      const response = await fetch(requestUrl, { headers, signal: controller.signal });
      if (!response.ok) throw new Error(`Unsplash search failed (${response.status})`);
      photos = ((await response.json()) as UnsplashSearch).results ?? [];
      await redis.set(cacheKey, photos, { ex: TTL_SECONDS }).catch(() => {});
    }
    return photos.filter((photo) => !photo.sponsorship && photo.urls?.raw && !NOT_A_PHOTO.some((word) => describedAs(photo).includes(word)));
  }

  /** The photos described as showing the scene -- or, with too few of those, its top-ranked results. */
  function matching(photos: UnsplashPhoto[], scene: DailyScene): UnsplashPhoto[] {
    const described = photos.filter((photo) => scene.match.some((word) => describedAs(photo).includes(word)));
    return described.length >= MIN_POOL ? described : photos.slice(0, TRUSTED_TOP);
  }

  try {
    let chosen: { scene: DailyScene; pool: UnsplashPhoto[] } | null = null;
    for (const scene of scenes) {
      let photos = await search(scene, page);
      if (photos.length < MIN_POOL && page > 1) photos = await search(scene, 1);
      const pool = matching(photos, scene);
      if (pool.length && (!chosen || pool.length > chosen.pool.length)) chosen = { scene, pool };
      if (pool.length >= MIN_POOL) break;
    }
    if (!chosen) throw new Error("Unsplash returned no photos");

    const selected = chosen.pool[params.randomize ? Math.floor(Math.random() * chosen.pool.length) : seed % chosen.pool.length];
    const imageUrl = new URL(selected.urls.raw);
    imageUrl.searchParams.set("w", String(DOWNLOAD_WIDTH));
    imageUrl.searchParams.set("q", "85");
    imageUrl.searchParams.set("fm", "jpg");
    const [imageResponse] = await Promise.all([
      fetch(imageUrl, { signal: controller.signal }),
      // Unsplash's guidelines: report each photo actually used.
      fetch(selected.links.download_location, { headers, signal: controller.signal }).catch(() => null),
    ]);
    if (!imageResponse.ok) throw new Error(`Unsplash image download failed (${imageResponse.status})`);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    return {
      buffer,
      contentType: "image/jpeg",
      extension: "jpg",
      prompt: `Unsplash daily scene: ${chosen.scene.query}. Photo by ${selected.user.name} (${selected.user.links.html}) on Unsplash (${selected.links.html})`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
