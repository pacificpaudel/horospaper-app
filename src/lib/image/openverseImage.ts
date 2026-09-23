import { dailyIntentQueries, DailyIntent } from "./dailyIntent";

const OPENVERSE_API = "https://api.openverse.org/v1/images/";
const REQUEST_TIMEOUT_MS = 8000;

interface OpenverseResult {
  id: string;
  url: string;
  title?: string;
  license?: string;
  creator?: string;
  attribution?: string;
  width?: number;
  height?: number;
}

interface OpenverseResponse {
  results?: OpenverseResult[];
}

function hash(input: string): number {
  let value = 0;
  for (const character of input) value = (Math.imul(31, value) + character.charCodeAt(0)) | 0;
  return Math.abs(value);
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
  // The most specific query is tried first for the best thematic match, but
  // a combined mood+theme phrase can collapse to a tiny pool -- so broader
  // fallbacks follow, ending in "${mood} art", which reliably returns
  // Openverse's full page of results for every mood.
  const queries = dailyIntentQueries(params.intent);
  const query = queries[0];
  const MIN_GOOD_POOL_SIZE = 15;
  const page = params.randomize ? 1 + Math.floor(Math.random() * 5) : 1;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  async function search(pageNumber: number): Promise<OpenverseResult[]> {
    let best: OpenverseResult[] = [];
    for (const searchQuery of queries) {
      const requestUrl = new URL(OPENVERSE_API);
      requestUrl.searchParams.set("q", searchQuery);
      requestUrl.searchParams.set("page_size", "20");
      requestUrl.searchParams.set("page", String(pageNumber));
      requestUrl.searchParams.set("mature", "false");
      const response = await fetch(requestUrl, {
        headers: { Accept: "application/json", "User-Agent": "horospaper/1.0" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Openverse search failed (${response.status})`);
      const payload = (await response.json()) as OpenverseResponse;
      const usable = (payload.results ?? []).filter((result) => result.url && result.width && result.height);
      if (usable.length > best.length) best = usable;
      // Stop once a query returns a healthy pool -- no need to keep
      // querying just to chase the guaranteed-broad last resort every time.
      if (best.length >= MIN_GOOD_POOL_SIZE) break;
    }
    return best;
  }

  try {
    let results = await search(page);
    // A randomized page can legitimately come back empty (fewer total
    // matches than `page * page_size`) -- page 1 always has the most
    // results, so it's the reliable fallback rather than a hard failure.
    if (!results.length && page > 1) results = await search(1);
    if (!results.length) throw new Error("Openverse returned no usable images");

    const selected = results[params.randomize ? Math.floor(Math.random() * results.length) : hash(params.stableSeed) % results.length];
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
    return { buffer, contentType, extension, prompt: `Openverse daily intent: ${query}. ${attribution}` };
  } finally {
    clearTimeout(timeout);
  }
}
