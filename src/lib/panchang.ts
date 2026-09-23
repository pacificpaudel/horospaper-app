import { createHash } from "node:crypto";
import { redis } from "@/lib/redis";

// Raw Panchang data from freeastroapi.com (POST /api/v2/vedic/panchang) --
// the single source for today's tithi/nakshatra/yoga/karana/rahu kalam.
// This is location-based, not birth-chart-based: it's the same for every
// user at the same place on the same day, so it's cached per (date,
// rounded location, timezone) and shared across everyone there, unlike the
// per-person freeastrologyapi.com calls in astrologyApi.ts (a different
// service, despite the similar name).
// Key: FREEASTRO_API_KEY. Free plan: 80 requests/day, 1 request/second.

const ENDPOINT = "https://api.freeastroapi.com/api/v2/vedic/panchang";
const REQUEST_TIMEOUT_MS = 15000;
const CACHE_TTL_SECONDS = 36 * 60 * 60;

export interface PanchangInput {
  date: string; // YYYY-MM-DD, the day being judged
  latitude: number;
  longitude: number;
  timezone: string; // IANA
}

interface PanchangField {
  number: number;
  name: string;
  ends_at?: string;
}

export interface PanchangData {
  date: string;
  weekday: string;
  sunrise: string;
  sunset: string;
  tithi: { number: number; name: string; paksha: string };
  nakshatra: { number: number; name: string; pada: number; lord: string };
  yoga: { number: number; name: string };
  karana: { number: number; name: string };
  rahuKalam: { start: string; end: string } | null;
  moonSign: string | null;
}

/**
 * Shared with panchangInsight.ts, so the raw Panchang and its LLM
 * interpretation are keyed identically per (date, rounded location, tz).
 * Rounded to ~1km -- Panchang transition times barely move over that
 * distance, and it lets nearby users share one cached entry/API call.
 */
export function panchangCacheKey(input: PanchangInput): string {
  const lat = input.latitude.toFixed(2);
  const lng = input.longitude.toFixed(2);
  return `${input.date}:${lat}:${lng}:${createHash("sha256").update(input.timezone).digest("hex").slice(0, 8)}`;
}

async function requestPanchang(apiKey: string, year: number, month: number, day: number, lat: number, lng: number, tz: string, signal: AbortSignal): Promise<Response> {
  return fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    // Judged at sunrise (the traditional start of the Panchang day), not
    // noon -- hour/minute here only need to land after actual sunrise so
    // the API resolves "today's" values rather than yesterday's leftovers.
    body: JSON.stringify({ year, month, day, hour: 6, minute: 0, lat, lng, tz_str: tz, ayanamsha: "lahiri" }),
    signal,
  });
}

/**
 * Today's Panchang for a location, or null when no key is configured, the
 * quota is spent, or the service is unreachable. Callers should fall back
 * to skipping the Panchang-derived signal entirely rather than guessing at
 * values -- an LLM (or any other code) must never invent tithi/nakshatra.
 */
export async function fetchPanchang(input: PanchangInput): Promise<PanchangData | null> {
  const apiKey = process.env.FREEASTRO_API_KEY;
  if (!apiKey) return null;

  const key = `panchang:v1:${panchangCacheKey(input)}`;
  const cached = await redis.get<PanchangData>(key).catch(() => null);
  if (cached) return cached;

  const [year, month, day] = input.date.split("-").map(Number);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let response = await requestPanchang(apiKey, year, month, day, input.latitude, input.longitude, input.timezone, controller.signal);
    if (response.status === 429) {
      const retryAfter = Math.min(3, Number(response.headers.get("retry-after")) || 1.2);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      response = await requestPanchang(apiKey, year, month, day, input.latitude, input.longitude, input.timezone, controller.signal);
    }
    if (!response.ok) throw new Error(`freeastroapi panchang ${response.status}`);

    const payload = (await response.json()) as {
      date?: string;
      weekday?: { name?: string };
      sunrise?: string;
      sunset?: string;
      tithi?: PanchangField & { paksha?: string };
      nakshatra?: PanchangField & { pada?: number; lord?: string };
      yoga?: PanchangField;
      karanas?: PanchangField[];
      rahu_kalam?: { start?: string; end?: string };
      request_time_panchang?: { moon_sign?: { name?: string } };
    };
    if (!payload.tithi?.name || !payload.nakshatra?.name || !payload.yoga?.name) {
      throw new Error("freeastroapi panchang response missing core fields");
    }

    const data: PanchangData = {
      date: payload.date ?? input.date,
      weekday: payload.weekday?.name ?? "",
      sunrise: payload.sunrise ?? "",
      sunset: payload.sunset ?? "",
      tithi: { number: payload.tithi.number, name: payload.tithi.name, paksha: payload.tithi.paksha ?? "" },
      nakshatra: { number: payload.nakshatra.number, name: payload.nakshatra.name, pada: payload.nakshatra.pada ?? 0, lord: payload.nakshatra.lord ?? "" },
      yoga: { number: payload.yoga.number, name: payload.yoga.name },
      karana: payload.karanas?.[0] ? { number: payload.karanas[0].number, name: payload.karanas[0].name } : { number: 0, name: "" },
      rahuKalam: payload.rahu_kalam?.start && payload.rahu_kalam.end ? { start: payload.rahu_kalam.start, end: payload.rahu_kalam.end } : null,
      moonSign: payload.request_time_panchang?.moon_sign?.name ?? null,
    };
    await redis.set(key, data, { ex: CACHE_TTL_SECONDS }).catch(() => {});
    return data;
  } catch (err) {
    console.warn("[panchang]", err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
