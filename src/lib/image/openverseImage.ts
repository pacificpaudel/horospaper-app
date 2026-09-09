import { dailyIntentQuery, DailyIntent } from "./dailyIntent";

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
}): Promise<{ buffer: Buffer; contentType: string; extension: string; prompt: string }> {
  const query = dailyIntentQuery(params.intent);
  const queries = [
    query,
    `${params.intent.keywords[0]} human emotion art`,
    `${params.intent.keywords[0]} ${params.intent.keywords[3]} mixed media`,
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let results: OpenverseResult[] = [];
    for (const searchQuery of queries) {
      const requestUrl = new URL(OPENVERSE_API);
      requestUrl.searchParams.set("q", searchQuery);
      requestUrl.searchParams.set("page_size", "20");
      requestUrl.searchParams.set("mature", "false");
      const response = await fetch(requestUrl, {
        headers: { Accept: "application/json", "User-Agent": "horospaper/1.0" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Openverse search failed (${response.status})`);
      const payload = (await response.json()) as OpenverseResponse;
      results = (payload.results ?? []).filter((result) => result.url && result.width && result.height);
      if (results.length) break;
    }
    if (!results.length) throw new Error("Openverse returned no usable images");

    const selected = results[hash(params.stableSeed) % results.length];
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
